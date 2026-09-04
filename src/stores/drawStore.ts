import { create } from 'zustand';
import type { Position } from 'geojson';
import { clearGpsDraft, getGpsDraft, saveGpsDraft } from '../db/routesDb';
import { pointAfterVertex, removeSpikePoints } from '../lib/geo/editGeometry';
import {
  permissionErrorMessage,
  queryGeoPermission,
  requestGeoPermission,
  requestWakeLock,
  type GeoPermissionState,
} from '../lib/geo/geolocation';

export type DrawMode = 'none' | 'click' | 'freehand' | 'gps' | 'edit';

interface DrawState {
  mode: DrawMode;
  points: Position[];
  isFreehandActive: boolean;
  editingRouteId: string | null;
  selectedPointIndex: number | null;
  gpsWatchId: number | null;
  gpsError: string | null;
  gpsPermission: GeoPermissionState;
  gpsPaused: boolean;
  gpsFollow: boolean;
  gpsAccuracy: number | null;
  gpsStartedAt: string | null;
  gpsWakeLock: WakeLockSentinel | null;
  setMode: (mode: DrawMode) => void;
  startEdit: (routeId: string, points: Position[]) => void;
  startGpsRecording: () => Promise<boolean>;
  resumeGpsDraft: () => Promise<boolean>;
  pauseGps: () => void;
  resumeGps: () => void;
  setGpsFollow: (follow: boolean) => void;
  addPoint: (point: Position) => void;
  updatePoint: (index: number, point: Position) => void;
  removePointAt: (index: number) => void;
  selectPoint: (index: number | null) => void;
  removeSelectedPoint: () => void;
  addPointAfterSelected: () => void;
  cleanGpsSpikes: () => number;
  undoLastPoint: () => void;
  setPoints: (points: Position[]) => void;
  appendPoints: (points: Position[]) => void;
  setFreehandActive: (active: boolean) => void;
  setGpsWatchId: (id: number | null) => void;
  setGpsError: (message: string | null) => void;
  setGpsAccuracy: (accuracy: number | null) => void;
  setGpsPermission: (state: GeoPermissionState) => void;
  setGpsWakeLock: (lock: WakeLockSentinel | null) => void;
  persistGpsDraft: () => Promise<void>;
  clearGpsSession: () => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

async function releaseWakeLock(lock: WakeLockSentinel | null) {
  if (!lock) return;
  try {
    await lock.release();
  } catch {
    // ignore
  }
}

function stopWatch(watchId: number | null) {
  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(watchId);
  }
}

export const useDrawStore = create<DrawState>((set, get) => ({
  mode: 'none',
  points: [],
  isFreehandActive: false,
  editingRouteId: null,
  selectedPointIndex: null,
  gpsWatchId: null,
  gpsError: null,
  gpsPermission: 'unknown',
  gpsPaused: false,
  gpsFollow: true,
  gpsAccuracy: null,
  gpsStartedAt: null,
  gpsWakeLock: null,

  setMode: (mode) => {
    const state = get();
    stopWatch(state.gpsWatchId);
    void releaseWakeLock(state.gpsWakeLock);
    if (state.mode === 'gps' && mode !== 'gps') {
      void clearGpsDraft();
    }
    set({
      mode,
      points: [],
      isFreehandActive: false,
      editingRouteId: null,
      selectedPointIndex: null,
      gpsWatchId: null,
      gpsError: null,
      gpsPaused: false,
      gpsAccuracy: null,
      gpsStartedAt: null,
      gpsWakeLock: null,
    });
  },

  startEdit: (routeId, points) => {
    const state = get();
    stopWatch(state.gpsWatchId);
    void releaseWakeLock(state.gpsWakeLock);
    void clearGpsDraft();
    set({
      mode: 'edit',
      editingRouteId: routeId,
      points: [...points],
      selectedPointIndex: null,
      isFreehandActive: false,
      gpsWatchId: null,
      gpsError: null,
      gpsPaused: false,
      gpsAccuracy: null,
      gpsStartedAt: null,
      gpsWakeLock: null,
    });
  },

  startGpsRecording: async () => {
    const state = get();
    stopWatch(state.gpsWatchId);
    void releaseWakeLock(state.gpsWakeLock);

    const permission = await queryGeoPermission();
    set({ gpsPermission: permission });

    if (permission === 'unsupported') {
      set({ gpsError: 'Geolocation is not supported in this browser' });
      return false;
    }

    try {
      await requestGeoPermission();
      set({ gpsPermission: 'granted', gpsError: null });
    } catch (error) {
      const message = permissionErrorMessage(error as GeolocationPositionError);
      set({
        gpsError: message,
        gpsPermission: (error as GeolocationPositionError).code === 1 ? 'denied' : permission,
      });
      return false;
    }

    const wakeLock = await requestWakeLock();
    const startedAt = new Date().toISOString();

    set({
      mode: 'gps',
      points: [],
      isFreehandActive: false,
      editingRouteId: null,
      selectedPointIndex: null,
      gpsWatchId: null,
      gpsError: null,
      gpsPaused: false,
      gpsAccuracy: null,
      gpsStartedAt: startedAt,
      gpsWakeLock: wakeLock,
      gpsFollow: true,
    });

    await saveGpsDraft({
      points: [],
      startedAt,
      updatedAt: startedAt,
      active: true,
      paused: false,
    });

    return true;
  },

  resumeGpsDraft: async () => {
    const draft = await getGpsDraft();
    if (!draft?.active || draft.points.length === 0) {
      return false;
    }

    try {
      await requestGeoPermission();
    } catch (error) {
      set({
        gpsError: permissionErrorMessage(error as GeolocationPositionError),
        gpsPermission: 'denied',
      });
      return false;
    }

    const wakeLock = await requestWakeLock();
    set({
      mode: 'gps',
      points: draft.points,
      editingRouteId: null,
      selectedPointIndex: null,
      isFreehandActive: false,
      gpsPaused: draft.paused,
      gpsStartedAt: draft.startedAt,
      gpsError: null,
      gpsPermission: 'granted',
      gpsWakeLock: wakeLock,
      gpsFollow: true,
      gpsAccuracy: null,
      gpsWatchId: null,
    });
    return true;
  },

  pauseGps: () => {
    const state = get();
    stopWatch(state.gpsWatchId);
    void releaseWakeLock(state.gpsWakeLock);
    set({ gpsPaused: true, gpsWatchId: null, gpsWakeLock: null });
    void get().persistGpsDraft();
  },

  resumeGps: () => {
    set({ gpsPaused: false, gpsError: null });
    void get().persistGpsDraft();
    void requestWakeLock().then((lock) => set({ gpsWakeLock: lock }));
  },

  setGpsFollow: (follow) => set({ gpsFollow: follow }),

  addPoint: (point) =>
    set((state) => ({
      points: [...state.points, point],
      selectedPointIndex: null,
    })),

  updatePoint: (index, point) =>
    set((state) => {
      if (index < 0 || index >= state.points.length) return state;
      const points = [...state.points];
      points[index] = point;
      return { points };
    }),

  removePointAt: (index) =>
    set((state) => {
      if (index < 0 || index >= state.points.length) return state;
      if (state.points.length <= 2) return state;
      const points = state.points.filter((_, i) => i !== index);
      const selectedPointIndex = index < points.length ? index : points.length - 1;
      return { points, selectedPointIndex };
    }),

  selectPoint: (index) => set({ selectedPointIndex: index }),

  removeSelectedPoint: () => {
    const { selectedPointIndex, points } = get();
    if (selectedPointIndex == null) {
      if (points.length > 2) {
        const next = points.slice(0, -1);
        set({ points: next, selectedPointIndex: next.length - 1 });
      }
      return;
    }
    get().removePointAt(selectedPointIndex);
  },

  addPointAfterSelected: () => {
    const { selectedPointIndex, points } = get();
    const insertAfter = selectedPointIndex ?? points.length - 1;
    const nextPoint = pointAfterVertex(points, insertAfter);
    if (!nextPoint) {
      return;
    }

    const next = [...points.slice(0, insertAfter + 1), nextPoint, ...points.slice(insertAfter + 1)];
    set({ points: next, selectedPointIndex: insertAfter + 1 });
  },

  cleanGpsSpikes: () => {
    const { points } = get();
    const result = removeSpikePoints(points);
    if (result.removed > 0) {
      set({ points: result.points, selectedPointIndex: null });
    }
    return result.removed;
  },

  undoLastPoint: () =>
    set((state) => ({
      points: state.points.slice(0, -1),
      selectedPointIndex: null,
    })),

  setPoints: (points) => set({ points, selectedPointIndex: null }),

  appendPoints: (points) =>
    set((state) => ({
      points: [...state.points, ...points],
    })),

  setFreehandActive: (active) => set({ isFreehandActive: active }),

  setGpsWatchId: (id) => set({ gpsWatchId: id }),

  setGpsError: (message) => set({ gpsError: message }),

  setGpsAccuracy: (accuracy) => set({ gpsAccuracy: accuracy }),

  setGpsPermission: (state) => set({ gpsPermission: state }),

  setGpsWakeLock: (lock) => set({ gpsWakeLock: lock }),

  persistGpsDraft: async () => {
    const state = get();
    if (state.mode !== 'gps') return;
    await saveGpsDraft({
      points: state.points,
      startedAt: state.gpsStartedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: true,
      paused: state.gpsPaused,
    });
  },

  clearGpsSession: async () => {
    const state = get();
    stopWatch(state.gpsWatchId);
    await releaseWakeLock(state.gpsWakeLock);
    await clearGpsDraft();
    set({
      gpsWatchId: null,
      gpsWakeLock: null,
      gpsPaused: false,
      gpsAccuracy: null,
      gpsStartedAt: null,
      gpsError: null,
    });
  },

  reset: () =>
    set({
      points: [],
      isFreehandActive: false,
      selectedPointIndex: null,
      gpsError: null,
    }),

  cancel: () => {
    const state = get();
    stopWatch(state.gpsWatchId);
    void releaseWakeLock(state.gpsWakeLock);
    if (state.mode === 'gps') {
      void clearGpsDraft();
    }
    set({
      mode: 'none',
      points: [],
      isFreehandActive: false,
      editingRouteId: null,
      selectedPointIndex: null,
      gpsWatchId: null,
      gpsError: null,
      gpsPaused: false,
      gpsAccuracy: null,
      gpsStartedAt: null,
      gpsWakeLock: null,
    });
  },
}));
