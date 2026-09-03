import { useCallback, useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { useDrawStore } from '../../stores/drawStore';

export function useGpsDraw(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
) {
  const mode = useDrawStore((state) => state.mode);
  const appendPoints = useDrawStore((state) => state.appendPoints);
  const setGpsWatchId = useDrawStore((state) => state.setGpsWatchId);
  const setGpsError = useDrawStore((state) => state.setGpsError);
  const lastPointRef = useRef<[number, number] | null>(null);

  const stopWatch = useCallback(() => {
    const watchId = useDrawStore.getState().gpsWatchId;
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setGpsWatchId(null);
    }
  }, [setGpsWatchId]);

  useEffect(() => {
    if (!mapLoaded || mode !== 'gps') {
      stopWatch();
      lastPointRef.current = null;
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported in this browser');
      return;
    }

    setGpsError(null);
    lastPointRef.current = null;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        const last = lastPointRef.current;
        if (last) {
          const dx = lng - last[0];
          const dy = lat - last[1];
          if (dx * dx + dy * dy < 0.00000004) {
            return;
          }
        }
        lastPointRef.current = [lng, lat];
        appendPoints([[lng, lat]]);

        const map = mapRef.current?.getMap();
        map?.easeTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 15),
          duration: 500,
        });
      },
      (error) => {
        setGpsError(error.message || 'Failed to read GPS position');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
    );

    setGpsWatchId(watchId);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setGpsWatchId(null);
    };
  }, [appendPoints, mapLoaded, mapRef, mode, setGpsError, setGpsWatchId, stopWatch]);
}
