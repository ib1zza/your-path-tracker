import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fitMapToRoute } from '../lib/geo/fitBounds';
import { routeCentroid } from '../lib/geo/globe';
import { useFitRouteOnSelect, useRoutesLayer } from '../features/map/useMapLayers';
import { useRouteStore } from '../stores/routeStore';
import type { RouteFeature } from '../types/route';

const GLOBE_STYLE: StyleSpecification = {
  version: 8,
  projection: {
    type: 'globe',
  },
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
    labels: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
    },
    {
      id: 'labels',
      type: 'raster',
      source: 'labels',
      minzoom: 5,
      paint: {
        'raster-opacity': 0.9,
      },
    },
  ],
  sky: {
    'sky-color': '#0b1026',
    'horizon-color': '#5b87c5',
    'fog-color': '#d7e6f5',
  },
};

function groupRoutesByPlace(routes: RouteFeature[]) {
  const groups = new globalThis.Map<string, RouteFeature[]>();
  for (const route of routes) {
    const key = route.properties.placeName || 'Unknown place';
    const list = groups.get(key) ?? [];
    list.push(route);
    groups.set(key, list);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function placePins(routes: RouteFeature[]) {
  const byPlace = new globalThis.Map<
    string,
    { lng: number; lat: number; color: string; count: number }
  >();

  for (const route of routes) {
    const center = routeCentroid(route);
    if (!center) continue;
    const key = route.properties.placeName || route.properties.name;
    const existing = byPlace.get(key);
    if (existing) {
      existing.lng = (existing.lng * existing.count + center[0]) / (existing.count + 1);
      existing.lat = (existing.lat * existing.count + center[1]) / (existing.count + 1);
      existing.count += 1;
    } else {
      byPlace.set(key, {
        lng: center[0],
        lat: center[1],
        color: route.properties.color,
        count: 1,
      });
    }
  }

  return [...byPlace.entries()];
}

function applyGlobeAtmosphere(map: MaplibreMap) {
  const maybeFog = map as MaplibreMap & {
    setFog?: (fog: Record<string, string | number>) => void;
  };
  maybeFog.setFog?.({
    color: 'rgb(186, 210, 235)',
    'high-color': 'rgb(36, 92, 223)',
    'horizon-blend': 0.03,
    'space-color': 'rgb(11, 11, 25)',
    'star-intensity': 0.65,
  });
}

export function GlobePage() {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showPins, setShowPins] = useState(true);

  const routes = useRouteStore((state) => state.routes);
  const selectedId = useRouteStore((state) => state.selectedId);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const ensurePlaceNames = useRouteStore((state) => state.ensurePlaceNames);

  const placeGroups = useMemo(() => groupRoutesByPlace(routes), [routes]);
  const pins = useMemo(() => placePins(routes), [routes]);

  const initialCenter = useMemo(() => {
    const first = routes[0];
    const center = first ? routeCentroid(first) : null;
    return {
      longitude: center?.[0] ?? 30.3,
      latitude: center?.[1] ?? 59.9,
      zoom: routes.length > 0 ? 3.2 : 1.6,
    };
  }, [routes]);

  useRoutesLayer(mapRef, mapLoaded, routes, selectedId, false);
  useFitRouteOnSelect(mapRef, mapLoaded, selectedId);

  useEffect(() => {
    void ensurePlaceNames();
  }, [ensurePlaceNames, routes.length]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;

    const syncPins = () => {
      setShowPins(map.getZoom() < 8);
    };

    syncPins();
    map.on('zoom', syncPins);
    return () => {
      map.off('zoom', syncPins);
    };
  }, [mapLoaded]);

  const flyToPlace = (place: string) => {
    const placeRoutes = routes.filter(
      (route) => (route.properties.placeName || 'Unknown place') === place,
    );
    if (placeRoutes.length === 0) return;

    selectRoute(placeRoutes[0].properties.id);
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (placeRoutes.length === 1) {
      fitMapToRoute(map, placeRoutes[0], 100);
      return;
    }

    const centers = placeRoutes
      .map((route) => routeCentroid(route))
      .filter((value): value is [number, number] => Boolean(value));
    if (centers.length === 0) return;

    let minLng = centers[0][0];
    let maxLng = centers[0][0];
    let minLat = centers[0][1];
    let maxLat = centers[0][1];
    for (const [lng, lat] of centers) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 120, duration: 1000, maxZoom: 12 },
    );
  };

  return (
    <div className="globe-page">
      <MapGL
        ref={mapRef}
        initialViewState={initialCenter}
        mapStyle={GLOBE_STYLE}
        style={{ width: '100%', height: '100%' }}
        projection="globe"
        dragRotate
        touchPitch
        pitchWithRotate
        minZoom={0}
        maxZoom={19}
        onLoad={(event) => {
          const map = event.target;
          try {
            map.setProjection({ type: 'globe' });
          } catch {
            // Projection may already be set in style.
          }
          applyGlobeAtmosphere(map);
          setMapLoaded(true);
        }}
      >
        <NavigationControl position="top-right" visualizePitch />
        {showPins &&
          pins.map(([place, pin]) => (
            <Marker
              key={place}
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                flyToPlace(place);
              }}
            >
              <button
                type="button"
                className="globe-map-pin"
                style={{ backgroundColor: pin.color }}
                title={place}
              >
                <span className="globe-map-pin__label">{place}</span>
              </button>
            </Marker>
          ))}
      </MapGL>

      <div className="globe-page__overlay">
        <h2>Visited places</h2>
        {routes.length === 0 ? (
          <p>Draw routes on the map to see them on the globe with real satellite imagery.</p>
        ) : (
          <>
            <p>
              {placeGroups.length} {placeGroups.length === 1 ? 'place' : 'places'} · drag to rotate,
              scroll to zoom from orbit to streets.
            </p>
            <ul className="globe-page__list">
              {placeGroups.map(([place, placeRoutes]) => (
                <li key={place} className="globe-page__group">
                  <button
                    type="button"
                    className="globe-page__place-btn"
                    onClick={() => flyToPlace(place)}
                  >
                    {place}
                  </button>
                  {placeRoutes.map((route) => (
                    <button
                      key={route.properties.id}
                      type="button"
                      className={`globe-page__item ${selectedId === route.properties.id ? 'globe-page__item--active' : ''}`}
                      onClick={() => selectRoute(route.properties.id)}
                    >
                      <span
                        className="globe-page__dot"
                        style={{ backgroundColor: route.properties.color }}
                      />
                      {route.properties.name}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
