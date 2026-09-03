import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import { useMapUiStore } from '../../stores/mapUiStore';

export const MY_LOCATION_SOURCE_ID = 'my-location';
export const MY_LOCATION_LAYER_ID = 'my-location-dot';

function ensureMyLocationLayer(map: Map) {
  if (!map.getSource(MY_LOCATION_SOURCE_ID)) {
    map.addSource(MY_LOCATION_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
  }

  if (!map.getLayer(MY_LOCATION_LAYER_ID)) {
    map.addLayer({
      id: MY_LOCATION_LAYER_ID,
      type: 'circle',
      source: MY_LOCATION_SOURCE_ID,
      paint: {
        'circle-radius': 8,
        'circle-color': '#2563eb',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
  }
}

function clearMyLocationLayer(map: Map) {
  const source = map.getSource(MY_LOCATION_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData({
    type: 'FeatureCollection',
    features: [],
  });
}

export function useMyLocationLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
) {
  const showMyLocation = useMapUiStore((state) => state.showMyLocation);
  const locationFollow = useMapUiStore((state) => state.locationFollow);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapLoaded || !showMyLocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      const map = mapRef.current?.getMap();
      if (map?.getSource(MY_LOCATION_SOURCE_ID)) {
        clearMyLocationLayer(map);
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }

    ensureMyLocationLayer(map);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const source = map.getSource(MY_LOCATION_SOURCE_ID) as GeoJSONSource | undefined;
        source?.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
            },
          ],
        });

        if (useMapUiStore.getState().locationFollow) {
          map.easeTo({
            center: [longitude, latitude],
            duration: 500,
          });
        }
      },
      () => {
        // Ignore transient errors; user can toggle off and on.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [locationFollow, mapLoaded, mapRef, showMyLocation]);
}
