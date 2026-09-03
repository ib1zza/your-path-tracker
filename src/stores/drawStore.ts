import { create } from 'zustand';
import type { Position } from 'geojson';

export type DrawMode = 'none' | 'click' | 'freehand' | 'gps' | 'edit';

interface DrawState {
  mode: DrawMode;
  points: Position[];
  isFreehandActive: boolean;
  editingRouteId: string | null;
  gpsWatchId: number | null;
  gpsError: string | null;
  setMode: (mode: DrawMode) => void;
  startEdit: (routeId: string, points: Position[]) => void;
  addPoint: (point: Position) => void;
  undoLastPoint: () => void;
  setPoints: (points: Position[]) => void;
  appendPoints: (points: Position[]) => void;
  setFreehandActive: (active: boolean) => void;
  setGpsWatchId: (id: number | null) => void;
  setGpsError: (message: string | null) => void;
  reset: () => void;
  cancel: () => void;
}

export const useDrawStore = create<DrawState>((set, get) => ({
  mode: 'none',
  points: [],
  isFreehandActive: false,
  editingRouteId: null,
  gpsWatchId: null,
  gpsError: null,

  setMode: (mode) => {
    const { gpsWatchId } = get();
    if (gpsWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(gpsWatchId);
    }
    set({
      mode,
      points: [],
      isFreehandActive: false,
      editingRouteId: null,
      gpsWatchId: null,
      gpsError: null,
    });
  },

  startEdit: (routeId, points) => {
    const { gpsWatchId } = get();
    if (gpsWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(gpsWatchId);
    }
    set({
      mode: 'edit',
      editingRouteId: routeId,
      points: [...points],
      isFreehandActive: false,
      gpsWatchId: null,
      gpsError: null,
    });
  },

  addPoint: (point) =>
    set((state) => ({
      points: [...state.points, point],
    })),

  undoLastPoint: () =>
    set((state) => ({
      points: state.points.slice(0, -1),
    })),

  setPoints: (points) => set({ points }),

  appendPoints: (points) =>
    set((state) => ({
      points: [...state.points, ...points],
    })),

  setFreehandActive: (active) => set({ isFreehandActive: active }),

  setGpsWatchId: (id) => set({ gpsWatchId: id }),

  setGpsError: (message) => set({ gpsError: message }),

  reset: () =>
    set({
      points: [],
      isFreehandActive: false,
      gpsError: null,
    }),

  cancel: () => {
    const { gpsWatchId } = get();
    if (gpsWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(gpsWatchId);
    }
    set({
      mode: 'none',
      points: [],
      isFreehandActive: false,
      editingRouteId: null,
      gpsWatchId: null,
      gpsError: null,
    });
  },
}));
