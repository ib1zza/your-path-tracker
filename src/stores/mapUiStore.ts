import { create } from 'zustand';
import type { MapStyleId } from '../lib/map/basemapStyles';

interface MapUiState {
  fitAllNonce: number;
  showMyLocation: boolean;
  locateNonce: number;
  mapStyleId: MapStyleId;
  globeStyleId: MapStyleId;
  requestFitAllRoutes: () => void;
  locateMe: () => void;
  setMapStyleId: (id: MapStyleId) => void;
  setGlobeStyleId: (id: MapStyleId) => void;
}

export const useMapUiStore = create<MapUiState>((set) => ({
  fitAllNonce: 0,
  showMyLocation: false,
  locateNonce: 0,
  mapStyleId: 'osm',
  globeStyleId: 'hybrid',

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
}));
