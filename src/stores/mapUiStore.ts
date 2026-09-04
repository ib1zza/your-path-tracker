import { create } from 'zustand';
import { routeMatchesDateRange } from '../lib/geo/routeDate';
import type { MapStyleId } from '../lib/map/basemapStyles';
import type { RouteFeature } from '../types/route';

export function routeMatchesFilterTags(route: RouteFeature, tags: string[]): boolean {
  return tags.length === 0 || tags.every((tag) => route.properties.tags?.includes(tag));
}

export function routeMatchesMapFilters(
  route: RouteFeature,
  tags: string[],
  dateFrom: string,
  dateTo: string,
): boolean {
  return (
    routeMatchesFilterTags(route, tags) &&
    routeMatchesDateRange(route, dateFrom || null, dateTo || null)
  );
}

interface MapUiState {
  fitAllNonce: number;
  showMyLocation: boolean;
  locateNonce: number;
  mapStyleId: MapStyleId;
  globeStyleId: MapStyleId;
  filterTags: string[];
  dateFrom: string;
  dateTo: string;
  requestFitAllRoutes: () => void;
  locateMe: () => void;
  setMapStyleId: (id: MapStyleId) => void;
  setGlobeStyleId: (id: MapStyleId) => void;
  setFilterTags: (tags: string[]) => void;
  toggleFilterTag: (tag: string) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
}

export const useMapUiStore = create<MapUiState>((set) => ({
  fitAllNonce: 0,
  showMyLocation: false,
  locateNonce: 0,
  mapStyleId: 'osm',
  globeStyleId: 'hybrid',
  filterTags: [],
  dateFrom: '',
  dateTo: '',

  requestFitAllRoutes: () =>
    set((state) => ({
      fitAllNonce: state.fitAllNonce + 1,
    })),

  locateMe: () =>
    set((state) => ({
      showMyLocation: true,
      locateNonce: state.locateNonce + 1,
    })),

  setMapStyleId: (id) => set({ mapStyleId: id }),
  setGlobeStyleId: (id) => set({ globeStyleId: id }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  toggleFilterTag: (tag) =>
    set((state) => ({
      filterTags: state.filterTags.includes(tag)
        ? state.filterTags.filter((item) => item !== tag)
        : [...state.filterTags, tag],
    })),
  setDateFrom: (value) => set({ dateFrom: value }),
  setDateTo: (value) => set({ dateTo: value }),
}));
