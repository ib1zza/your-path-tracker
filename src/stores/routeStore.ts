import { create } from 'zustand';
import { persistRoute, persistRoutes, removeRoute, loadRoutesForCurrentUser } from '../lib/firebase/syncRoutes';
import { readRouteFiles, type ImportKind, type ReadRouteFilesResult } from '../lib/geo/exportImport';
import { resolveRoutePlaceName } from '../lib/geo/geocode';
import { routeCentroid } from '../lib/geo/globe';
import { extractImportedCreatedAt, getRouteActivityDate, getRouteTimeKey } from '../lib/geo/routeDate';
import { thinRoutes } from '../lib/geo/routeGeometry';
import type { RouteFeature } from '../types/route';

interface RouteState {
  routes: RouteFeature[];
  selectedId: string | null;
  hiddenIds: Set<string>;
  isLoading: boolean;
  heatmapEnabled: boolean;
  loadRoutes: () => Promise<void>;
  addRoute: (route: RouteFeature) => Promise<void>;
  updateRoute: (route: RouteFeature) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
  selectRoute: (id: string | null) => void;
  toggleVisibility: (id: string) => void;
  isVisible: (id: string) => boolean;
  toggleHeatmap: () => void;
  ensurePlaceNames: () => Promise<void>;
  importRoutes: (
    files: File[] | File,
    overwrite: boolean,
    kind?: ImportKind,
  ) => Promise<{ imported: number; skipped: number }>;
  applyImportedRoutes: (
    parsed: ReadRouteFilesResult,
    overwrite: boolean,
  ) => Promise<{ imported: number; skipped: number }>;
  applyRoutes: (routes: RouteFeature[]) => void;
}

const PLACE_NAME_GAP_MS = 1100;

let placeNamesInFlight: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  selectedId: null,
  hiddenIds: new Set(),
  isLoading: true,
  heatmapEnabled: false,

  loadRoutes: async () => {
    set({ isLoading: true });
    const loaded = await loadRoutesForCurrentUser();
    const { routes: thinned, changed: thinnedChanged } = thinRoutes(loaded);

    // Backfill activity dates from GPX/Health-style names when createdAt is just import time.
    const dateFixed: RouteFeature[] = [];
    const withDates = thinned.map((route) => {
      const inferred = extractImportedCreatedAt(
        { name: route.properties.name },
        route.properties.name,
      );
      if (!inferred) return route;
      const current = Date.parse(route.properties.createdAt);
      const inferredTime = Date.parse(inferred);
      // If name encodes a date far from createdAt, prefer the name date.
      if (
        Number.isNaN(current) ||
        Math.abs(current - inferredTime) > 1000 * 60 * 60 * 36
      ) {
        const updated: RouteFeature = {
          ...route,
          properties: {
            ...route.properties,
            createdAt: inferred,
          },
        };
        dateFixed.push(updated);
        return updated;
      }
      return route;
    });

    const changedMap = new Map<string, RouteFeature>();
    for (const route of [...thinnedChanged, ...dateFixed]) {
      changedMap.set(route.properties.id, route);
    }
    const changed = [...changedMap.values()];
    if (changed.length > 0) {
      await persistRoutes(changed);
    }

    // Newest activity first.
    const routes = [...withDates].sort(
      (a, b) => getRouteActivityDate(b).getTime() - getRouteActivityDate(a).getTime(),
    );

    set({ routes, isLoading: false });
    // Defer geocoding so the UI stays interactive after load/import.
    window.setTimeout(() => {
      void get().ensurePlaceNames();
    }, 0);
  },

  addRoute: async (route) => {
    const thinned = thinRoutes([route]).routes[0] ?? route;
    await persistRoute(thinned);
    set((state) => ({ routes: [thinned, ...state.routes] }));
    window.setTimeout(() => {
      void get().ensurePlaceNames();
    }, 0);
  },

  updateRoute: async (route) => {
    await persistRoute(route);
    set((state) => ({
      routes: state.routes.map((item) =>
        item.properties.id === route.properties.id ? route : item,
      ),
    }));
  },

  deleteRoute: async (id) => {
    await removeRoute(id);
    set((state) => {
      const hiddenIds = new Set(state.hiddenIds);
      hiddenIds.delete(id);
      return {
        routes: state.routes.filter((route) => route.properties.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
        hiddenIds,
      };
    });
  },

  selectRoute: (id) => set({ selectedId: id }),

  toggleVisibility: (id) =>
    set((state) => {
      const hiddenIds = new Set(state.hiddenIds);
      if (hiddenIds.has(id)) {
        hiddenIds.delete(id);
      } else {
        hiddenIds.add(id);
      }
      return { hiddenIds };
    }),

  isVisible: (id) => !get().hiddenIds.has(id),

  toggleHeatmap: () => set((state) => ({ heatmapEnabled: !state.heatmapEnabled })),

  ensurePlaceNames: async () => {
    if (placeNamesInFlight) {
      return placeNamesInFlight;
    }

    placeNamesInFlight = (async () => {
      const missing = get().routes.filter((route) => !route.properties.placeName);
      if (missing.length === 0) {
        return;
      }

      const updates = new Map<string, RouteFeature>();

      for (let index = 0; index < missing.length; index += 1) {
        const route = missing[index];
        const center = routeCentroid(route);
        if (!center) continue;

        try {
          const placeName = await resolveRoutePlaceName(center[0], center[1]);
          if (!placeName) continue;
          updates.set(route.properties.id, {
            ...route,
            properties: {
              ...route.properties,
              placeName,
              updatedAt: new Date().toISOString(),
            },
          });
        } catch {
          // Nominatim may rate-limit; keep going for remaining routes.
        }

        if (index < missing.length - 1) {
          await sleep(PLACE_NAME_GAP_MS);
        }
      }

      if (updates.size === 0) {
        return;
      }

      const updatedList = [...updates.values()];
      await persistRoutes(updatedList);
      set((state) => ({
        routes: state.routes.map((item) => updates.get(item.properties.id) ?? item),
      }));
    })().finally(() => {
      placeNamesInFlight = null;
    });

    return placeNamesInFlight;
  },

  applyRoutes: (routes) => {
    const sorted = [...routes].sort(
      (a, b) => getRouteActivityDate(b).getTime() - getRouteActivityDate(a).getTime(),
    );
    set({ routes: sorted, isLoading: false });
  },

  importRoutes: async (files, overwrite, kind = 'auto') => {
    const list = Array.isArray(files) ? files : [files];
    const parsed = await readRouteFiles(list, get().routes.length, kind);
    return get().applyImportedRoutes(parsed, overwrite);
  },

  applyImportedRoutes: async (parsed, overwrite) => {
    const { routes: incoming, appleHealth } = parsed;
    const existing = get().routes;
    const existingIds = new Set(existing.map((route) => route.properties.id));
    const existingByTime = new Map<string, RouteFeature>();

    if (appleHealth) {
      for (const route of existing) {
        const timeKey = getRouteTimeKey(route);
        if (!existingByTime.has(timeKey)) {
          existingByTime.set(timeKey, route);
        }
      }
    }

    const toSave: RouteFeature[] = [];
    let skipped = 0;

    for (let route of incoming) {
      if (existingIds.has(route.properties.id) && !overwrite) {
        skipped += 1;
        continue;
      }

      if (appleHealth) {
        const timeKey = getRouteTimeKey(route);
        const existingAtTime = existingByTime.get(timeKey);
        if (existingAtTime && existingAtTime.properties.id !== route.properties.id) {
          if (!overwrite) {
            skipped += 1;
            continue;
          }

          route = {
            ...route,
            properties: {
              ...route.properties,
              id: existingAtTime.properties.id,
            },
          };
        }
      }

      toSave.push(route);
      existingIds.add(route.properties.id);
      if (appleHealth) {
        existingByTime.set(getRouteTimeKey(route), route);
      }
    }

    if (toSave.length > 0) {
      const thinned = thinRoutes(toSave).routes;
      await persistRoutes(thinned);
      await get().loadRoutes();
    }

    return { imported: toSave.length, skipped };
  },
}));
