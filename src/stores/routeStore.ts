import { create } from 'zustand';
import {
  deleteRoute as deleteRouteFromDb,
  getAllRoutes,
  saveRoute,
  saveRoutes,
} from '../db/routesDb';
import { readRouteFile } from '../lib/geo/exportImport';
import { resolveRoutePlaceName } from '../lib/geo/geocode';
import { routeCentroid } from '../lib/geo/globe';
import type { MapStyleId } from '../features/map/mapConfig';
import type { RouteFeature } from '../types/route';

interface RouteState {
  routes: RouteFeature[];
  selectedId: string | null;
  hiddenIds: Set<string>;
  isLoading: boolean;
  heatmapEnabled: boolean;
  mapStyleId: MapStyleId;
  loadRoutes: () => Promise<void>;
  addRoute: (route: RouteFeature) => Promise<void>;
  updateRoute: (route: RouteFeature) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
  selectRoute: (id: string | null) => void;
  toggleVisibility: (id: string) => void;
  isVisible: (id: string) => boolean;
  toggleHeatmap: () => void;
  setMapStyleId: (id: MapStyleId) => void;
  ensurePlaceNames: () => Promise<void>;
  importRoutes: (file: File, overwrite: boolean) => Promise<{ imported: number; skipped: number }>;
}

const MAP_STYLE_KEY = 'path-tracker-map-style';

function loadMapStyle(): MapStyleId {
  const value = localStorage.getItem(MAP_STYLE_KEY);
  if (value === 'osm' || value === 'dark' || value === 'topo') {
    return value;
  }
  return 'osm';
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  selectedId: null,
  hiddenIds: new Set(),
  isLoading: true,
  heatmapEnabled: false,
  mapStyleId: loadMapStyle(),

  loadRoutes: async () => {
    set({ isLoading: true });
    const routes = await getAllRoutes();
    set({ routes, isLoading: false });
    void get().ensurePlaceNames();
  },

  addRoute: async (route) => {
    await saveRoute(route);
    set((state) => ({ routes: [route, ...state.routes] }));
    void get().ensurePlaceNames();
  },

  updateRoute: async (route) => {
    await saveRoute(route);
    set((state) => ({
      routes: state.routes.map((item) =>
        item.properties.id === route.properties.id ? route : item,
      ),
    }));
  },

  deleteRoute: async (id) => {
    await deleteRouteFromDb(id);
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

  setMapStyleId: (id) => {
    localStorage.setItem(MAP_STYLE_KEY, id);
    set({ mapStyleId: id });
  },

  ensurePlaceNames: async () => {
    const missing = get().routes.filter((route) => !route.properties.placeName);
    for (const route of missing) {
      const center = routeCentroid(route);
      if (!center) continue;
      try {
        const placeName = await resolveRoutePlaceName(center[0], center[1]);
        if (!placeName) continue;
        const updated: RouteFeature = {
          ...route,
          properties: {
            ...route.properties,
            placeName,
            updatedAt: new Date().toISOString(),
          },
        };
        await saveRoute(updated);
        set((state) => ({
          routes: state.routes.map((item) =>
            item.properties.id === updated.properties.id ? updated : item,
          ),
        }));
      } catch {
        // Nominatim may rate-limit; keep going for remaining routes.
      }
    }
  },

  importRoutes: async (file, overwrite) => {
    const incoming = await readRouteFile(file, get().routes.length);
    const existing = get().routes;
    const existingIds = new Set(existing.map((route) => route.properties.id));

    const toSave: RouteFeature[] = [];
    let skipped = 0;

    for (const route of incoming) {
      if (existingIds.has(route.properties.id) && !overwrite) {
        skipped += 1;
        continue;
      }
      toSave.push(route);
    }

    if (toSave.length > 0) {
      await saveRoutes(toSave);
      await get().loadRoutes();
    }

    return { imported: toSave.length, skipped };
  },
}));
