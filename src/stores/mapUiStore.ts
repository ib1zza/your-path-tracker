import { create } from 'zustand';

interface MapUiState {
  fitAllNonce: number;
  showMyLocation: boolean;
  locationFollow: boolean;
  requestFitAllRoutes: () => void;
  toggleMyLocation: () => void;
  toggleLocationFollow: () => void;
}

export const useMapUiStore = create<MapUiState>((set) => ({
  fitAllNonce: 0,
  showMyLocation: false,
  locationFollow: false,

  requestFitAllRoutes: () =>
    set((state) => ({
      fitAllNonce: state.fitAllNonce + 1,
    })),

  toggleMyLocation: () =>
    set((state) => ({
      showMyLocation: !state.showMyLocation,
      locationFollow: state.showMyLocation ? false : state.locationFollow,
    })),

  toggleLocationFollow: () =>
    set((state) => ({
      locationFollow: !state.locationFollow,
    })),
}));
