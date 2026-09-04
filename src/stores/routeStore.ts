import { create } from 'zustand';
import {
  persistRoute,
  replacePersistedRoutes,
  removeRoute,
  loadRoutesForCurrentUser,
} from '../lib/firebase/syncRoutes';
import {
  readRouteFiles,
  type ImportKind,
  type ReadRouteFilesResult,
} from '../lib/geo/exportImport';
import { placeCellKey, rememberPlaceName, resolveRoutePlaceName } from '../lib/geo/geocode';
import { routeCentroid } from '../lib/geo/globe';
import {
  dedupeRoutes,
  extractImportedCreatedAt,
  findMatchingRoute,
  getRouteActivityDate,
  getRouteDedupKeys,
  indexRoutesForDedup,
} from '../lib/geo/routeDate';
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
  removeDuplicateRoutes: () => Promise<{ removed: number }>;
  clearAllRoutes: () => Promise<void>;
}

const PLACE_NAME_GAP_MS = 1100;

let placeNamesInFlight: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function sortByActivity(routes: RouteFeature[]): RouteFeature[] {
  return [...routes].sort(
    (a, b) => getRouteActivityDate(b).getTime() - getRouteActivityDate(a).getTime(),
  );
}

function seedPlaceCache(routes: RouteFeature[]): void {
  for (const route of routes) {
    const placeName = route.properties.placeName;
    if (!placeName) continue;
    const center = routeCentroid(route);
    if (!center) continue;
    rememberPlaceName(center[0], center[1], placeName);
  }
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
      if (Number.isNaN(current) || Math.abs(current - inferredTime) > 1000 * 60 * 60 * 36) {
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

    const routes = sortByActivity(withDates);

    // One snapshot write if thinning/date backfill mutated anything.
    if (changed.length > 0) {
      await replacePersistedRoutes(routes);
    }

    seedPlaceCache(routes);
    set({ routes, isLoading: false });
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
      const current = get().routes;
      const missing = current.filter((route) => !route.properties.placeName);
      if (missing.length === 0) {
        return;
      }

      // Cluster by ~1 km cell so nearby routes share one Nominatim call.
      const cellToRouteIds = new Map<string, string[]>();
      const cellSample = new Map<string, { lng: number; lat: number }>();

      for (const route of missing) {
        const center = routeCentroid(route);
        if (!center) continue;
        const key = placeCellKey(center[0], center[1]);
        const list = cellToRouteIds.get(key);
        if (list) {
          list.push(route.properties.id);
        } else {
          cellToRouteIds.set(key, [route.properties.id]);
          cellSample.set(key, { lng: center[0], lat: center[1] });
        }
      }

      if (cellToRouteIds.size === 0) {
        return;
      }

      const cellPlaceNames = new Map<string, string>();
      const cells = [...cellToRouteIds.keys()];

      for (let index = 0; index < cells.length; index += 1) {
        const key = cells[index];
        const sample = cellSample.get(key);
        if (!sample) continue;

        try {
          const placeName = await resolveRoutePlaceName(sample.lng, sample.lat);
          if (placeName) {
            cellPlaceNames.set(key, placeName);
          }
        } catch {
          // Nominatim may rate-limit; keep going for remaining cells.
        }

        if (index < cells.length - 1) {
          await sleep(PLACE_NAME_GAP_MS);
        }
      }

      if (cellPlaceNames.size === 0) {
        return;
      }

      const now = new Date().toISOString();
      const idToPlace = new Map<string, string>();
      for (const [cell, placeName] of cellPlaceNames) {
        for (const id of cellToRouteIds.get(cell) ?? []) {
          idToPlace.set(id, placeName);
        }
      }

      const next = current.map((route) => {
        const placeName = idToPlace.get(route.properties.id);
        if (!placeName || route.properties.placeName) {
          return route;
        }
        return {
          ...route,
          properties: {
            ...route.properties,
            placeName,
            updatedAt: now,
          },
        };
      });

      // One snapshot write for the whole list — not per-route cloud fetches.
      await replacePersistedRoutes(next);
      set({ routes: next });
    })().finally(() => {
      placeNamesInFlight = null;
    });

    return placeNamesInFlight;
  },

  applyRoutes: (routes) => {
    seedPlaceCache(routes);
    set({ routes: sortByActivity(routes), isLoading: false });
  },

  importRoutes: async (files, overwrite, kind = 'auto') => {
    const list = Array.isArray(files) ? files : [files];
    const parsed = await readRouteFiles(list, get().routes.length, kind);
    return get().applyImportedRoutes(parsed, overwrite);
  },

  applyImportedRoutes: async (parsed, overwrite) => {
    const incomingRaw = thinRoutes(parsed.routes).routes;
    // Collapse duplicates inside the import batch itself (same Health export twice, etc.).
    const { routes: incoming } = dedupeRoutes(incomingRaw);

    const existing = get().routes;
    const { byId, byKey } = indexRoutesForDedup(existing);

    const nextById = new Map(existing.map((route) => [route.properties.id, route]));
    let imported = 0;
    let skipped = 0;

    for (const route of incoming) {
      const match = findMatchingRoute(route, byId, byKey);

      if (match) {
        if (!overwrite) {
          skipped += 1;
          continue;
        }

        // Keep stable id / color / notes / placeName from the local copy unless incoming has them.
        const merged: RouteFeature = {
          ...route,
          properties: {
            ...route.properties,
            id: match.properties.id,
            color: match.properties.color,
            notes: route.properties.notes ?? match.properties.notes,
            placeName: route.properties.placeName ?? match.properties.placeName,
            updatedAt: new Date().toISOString(),
          },
        };
        nextById.set(merged.properties.id, merged);
        imported += 1;

        byId.set(merged.properties.id, merged);
        for (const key of getRouteDedupKeys(merged)) {
          byKey.set(key, merged);
        }
        continue;
      }

      nextById.set(route.properties.id, route);
      imported += 1;
      byId.set(route.properties.id, route);
      for (const key of getRouteDedupKeys(route)) {
        byKey.set(key, route);
      }
    }

    if (imported === 0) {
      return { imported: 0, skipped };
    }

    const next = sortByActivity([...nextById.values()]);
    await replacePersistedRoutes(next);
    seedPlaceCache(next);
    set({ routes: next, isLoading: false });
    window.setTimeout(() => {
      void get().ensurePlaceNames();
    }, 0);

    return { imported, skipped };
  },

  removeDuplicateRoutes: async () => {
    const { routes, removedIds } = dedupeRoutes(get().routes);
    if (removedIds.length === 0) {
      return { removed: 0 };
    }

    const next = sortByActivity(routes);
    await replacePersistedRoutes(next);

    const removedSet = new Set(removedIds);
    set((state) => {
      const hiddenIds = new Set(state.hiddenIds);
      for (const id of removedIds) {
        hiddenIds.delete(id);
      }
      return {
        routes: next,
        selectedId: state.selectedId && removedSet.has(state.selectedId) ? null : state.selectedId,
        hiddenIds,
      };
    });

    return { removed: removedIds.length };
  },

  clearAllRoutes: async () => {
    await replacePersistedRoutes([]);
    set({
      routes: [],
      selectedId: null,
      hiddenIds: new Set(),
    });
  },
}));
