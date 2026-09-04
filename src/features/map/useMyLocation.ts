import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import { useMapUiStore } from '../../stores/mapUiStore';

export const MY_LOCATION_SOURCE_ID = 'my-location';
export const MY_LOCATION_LAYER_ID = 'my-location-dot';

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 20000,
};

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

function setMyLocationPoint(map: Map, longitude: number, latitude: number) {
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
}

function flyToMyLocation(map: Map, longitude: number, latitude: number) {
  map.easeTo({
    center: [longitude, latitude],
    zoom: Math.max(map.getZoom(), 14),
    duration: 700,
  });
}

function clearMyLocationLayer(map: Map) {
  const source = map.getSource(MY_LOCATION_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData({
    type: 'FeatureCollection',
    features: [],
  });
}

export function useMyLocationLayer(mapRef: React.RefObject<MapRef | null>, mapLoaded: boolean) {
  const showMyLocation = useMapUiStore((state) => state.showMyLocation);
  const locateNonce = useMapUiStore((state) => state.locateNonce);
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
        setMyLocationPoint(map, position.coords.longitude, position.coords.latitude);
      },
      () => {
        // Ignore transient errors; user can tap My location again.
      },
      GEO_OPTIONS,
    );

    const onStyleLoad = () => {
      ensureMyLocationLayer(map);
    };
    map.on('style.load', onStyleLoad);

    return () => {
      map.off('style.load', onStyleLoad);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [mapLoaded, mapRef, showMyLocation]);

  useEffect(() => {
    if (!mapLoaded || locateNonce === 0 || !('geolocation' in navigator)) {
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }

    ensureMyLocationLayer(map);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setMyLocationPoint(map, longitude, latitude);
        flyToMyLocation(map, longitude, latitude);
      },
      () => {
        // Permission denied or timeout — marker watch may still succeed later.
      },
      GEO_OPTIONS,
    );
  }, [locateNonce, mapLoaded, mapRef]);
}
