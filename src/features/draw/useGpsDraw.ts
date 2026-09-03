import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { permissionErrorMessage, requestWakeLock } from '../../lib/geo/geolocation';
import { useDrawStore } from '../../stores/drawStore';

const MIN_DISTANCE_DEG = 0.00002; // ~2m
const MAX_ACCURACY_M = 55;

export function useGpsDraw(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
) {
  const mode = useDrawStore((state) => state.mode);
  const gpsPaused = useDrawStore((state) => state.gpsPaused);
  const gpsFollow = useDrawStore((state) => state.gpsFollow);
  const appendPoints = useDrawStore((state) => state.appendPoints);
  const setGpsWatchId = useDrawStore((state) => state.setGpsWatchId);
  const setGpsError = useDrawStore((state) => state.setGpsError);
  const setGpsAccuracy = useDrawStore((state) => state.setGpsAccuracy);
  const persistGpsDraft = useDrawStore((state) => state.persistGpsDraft);
  const setGpsWakeLock = useDrawStore((state) => state.setGpsWakeLock);
  const lastPointRef = useRef<[number, number] | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapLoaded || mode !== 'gps' || gpsPaused) {
      const watchId = useDrawStore.getState().gpsWatchId;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setGpsWatchId(null);
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported in this browser');
      return;
    }

    const existingPoints = useDrawStore.getState().points;
    if (existingPoints.length > 0) {
      const last = existingPoints[existingPoints.length - 1];
      lastPointRef.current = [last[0], last[1]];
    } else {
      lastPointRef.current = null;
    }

    const schedulePersist = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void persistGpsDraft();
      }, 800);
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude: lng, latitude: lat, accuracy } = position.coords;
        setGpsAccuracy(accuracy);

        if (Number.isFinite(accuracy) && accuracy > MAX_ACCURACY_M) {
          return;
        }

        const last = lastPointRef.current;
        if (last) {
          const dx = lng - last[0];
          const dy = lat - last[1];
          if (dx * dx + dy * dy < MIN_DISTANCE_DEG * MIN_DISTANCE_DEG) {
            return;
          }
        }

        lastPointRef.current = [lng, lat];
        appendPoints([[lng, lat]]);
        schedulePersist();

        if (useDrawStore.getState().gpsFollow) {
          const map = mapRef.current?.getMap();
          map?.easeTo({
            center: [lng, lat],
            zoom: Math.max(map.getZoom(), 16),
            duration: 650,
          });
        }
      },
      (error) => {
        setGpsError(permissionErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 20000,
      },
    );

    setGpsWatchId(watchId);
    setGpsError(null);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setGpsWatchId(null);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    appendPoints,
    gpsPaused,
    mapLoaded,
    mapRef,
    mode,
    persistGpsDraft,
    setGpsAccuracy,
    setGpsError,
    setGpsWatchId,
  ]);

  useEffect(() => {
    if (mode !== 'gps') return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !useDrawStore.getState().gpsPaused) {
        void requestWakeLock().then((lock) => {
          if (lock) setGpsWakeLock(lock);
        });
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [mode, setGpsWakeLock]);

  useEffect(() => {
    if (mode !== 'gps') return;
    void persistGpsDraft();
  }, [gpsFollow, gpsPaused, mode, persistGpsDraft]);
}
