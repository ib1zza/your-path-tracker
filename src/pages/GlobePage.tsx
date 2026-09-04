import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PlaceSearch } from '../features/map/PlaceSearch';
import { applyBasemapAtmosphere, getBasemapStyle } from '../lib/map/basemapStyles';
import { fitMapToRoute, fitMapToRoutes } from '../lib/geo/fitBounds';
import { routeCentroid } from '../lib/geo/globe';
import { routesGeometryKey } from '../lib/geo/routeGeometry';
import {
  queryRouteIdAtPoint,
  ROUTES_HIT_LAYER_ID,
  ROUTES_LINE_LAYER_ID,
  ROUTES_OUTLINE_LAYER_ID,
  useFitRouteOnSelect,
  useHeatmapLayer,
  useRoutesLayer,
} from '../features/map/useMapLayers';
import { useMyLocationLayer } from '../features/map/useMyLocation';
import { routeMatchesMapFilters, useMapUiStore } from '../stores/mapUiStore';
import { useRouteStore } from '../stores/routeStore';
import type { RouteFeature } from '../types/route';

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

export function GlobePage() {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showPins, setShowPins] = useState(true);

  const routes = useRouteStore((state) => state.routes);
  const selectedId = useRouteStore((state) => state.selectedId);
  const hiddenIds = useRouteStore((state) => state.hiddenIds);
  const heatmapEnabled = useRouteStore((state) => state.heatmapEnabled);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const ensurePlaceNames = useRouteStore((state) => state.ensurePlaceNames);
  const fitAllNonce = useMapUiStore((state) => state.fitAllNonce);
  const filterTags = useMapUiStore((state) => state.filterTags);
  const dateFrom = useMapUiStore((state) => state.dateFrom);
  const dateTo = useMapUiStore((state) => state.dateTo);
  const globeStyleId = useMapUiStore((state) => state.globeStyleId);
  const globeStyle = useMemo(() => getBasemapStyle(globeStyleId, true), [globeStyleId]);

  const geometryKey = useMemo(() => routesGeometryKey(routes), [routes]);

  const visibleRoutes = useMemo(() => {
    return routes.filter((route) => {
      if (hiddenIds.has(route.properties.id)) return false;
      if (!routeMatchesMapFilters(route, filterTags, dateFrom, dateTo)) return false;
      if (selectedId && route.properties.id !== selectedId) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, filterTags, geometryKey, hiddenIds, selectedId]);

  const pins = useMemo(() => placePins(visibleRoutes), [visibleRoutes]);

  const initialCenter = useMemo(() => {
    const first = routes[0];
    const center = first ? routeCentroid(first) : null;
    return {
      longitude: center?.[0] ?? 30.3,
      latitude: center?.[1] ?? 59.9,
      zoom: routes.length > 0 ? 3.2 : 1.6,
    };
  }, [routes]);

  useRoutesLayer(mapRef, mapLoaded, visibleRoutes, selectedId, heatmapEnabled);
  useHeatmapLayer(mapRef, mapLoaded, visibleRoutes, heatmapEnabled);
  useFitRouteOnSelect(mapRef, mapLoaded, selectedId);
  useMyLocationLayer(mapRef, mapLoaded);

  useEffect(() => {
    void ensurePlaceNames();
  }, [ensurePlaceNames, routes.length]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;

    applyBasemapAtmosphere(map, globeStyleId);
    const onStyleLoad = () => applyBasemapAtmosphere(map, globeStyleId);
    map.on('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [globeStyleId, mapLoaded]);

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

  useEffect(() => {
    if (!mapLoaded || fitAllNonce === 0) {
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }

    const routesToFit = routes.filter(
      (route) =>
        !hiddenIds.has(route.properties.id) &&
        routeMatchesMapFilters(route, filterTags, dateFrom, dateTo),
    );
    fitMapToRoutes(map, routesToFit);
  }, [dateFrom, dateTo, filterTags, fitAllNonce, hiddenIds, mapLoaded, routes]);

  const flyToPlace = (place: string) => {
    const placeRoutes = visibleRoutes.filter(
      (route) => (route.properties.placeName || route.properties.name) === place,
    );
    if (placeRoutes.length === 0) return;

    selectRoute(placeRoutes[0].properties.id);
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (placeRoutes.length === 1) {
      fitMapToRoute(map, placeRoutes[0], 100);
    }
  };

  return (
    <div className="globe-page">
      <MapGL
        ref={mapRef}
        initialViewState={initialCenter}
        mapStyle={globeStyle}
        style={{ width: '100%', height: '100%' }}
        projection="globe"
        dragRotate
        touchPitch
        pitchWithRotate
        minZoom={0}
        maxZoom={19}
        cursor="grab"
        interactiveLayerIds={[ROUTES_HIT_LAYER_ID, ROUTES_LINE_LAYER_ID, ROUTES_OUTLINE_LAYER_ID]}
        onClick={(event) => {
          const map = mapRef.current?.getMap();
          if (!map) {
            selectRoute(null);
            return;
          }
          selectRoute(queryRouteIdAtPoint(map, event.point));
        }}
        onLoad={(event) => {
          const map = event.target;
          try {
            map.setProjection({ type: 'globe' });
          } catch {
            // Projection may already be set in style.
          }
          applyBasemapAtmosphere(map, globeStyleId);
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

      <div className="map-view__search">
        <PlaceSearch
          onSelect={(place) => {
            const map = mapRef.current?.getMap();
            if (!map) return;
            if (place.bbox) {
              map.fitBounds(
                [
                  [place.bbox[0], place.bbox[1]],
                  [place.bbox[2], place.bbox[3]],
                ],
                { padding: 60, duration: 900, maxZoom: 14 },
              );
            } else {
              map.flyTo({
                center: [place.longitude, place.latitude],
                zoom: 6,
                duration: 900,
              });
            }
          }}
        />
      </div>

      {heatmapEnabled && (
        <div className="heatmap-legend">
          <span>1 visit</span>
          <div className="heatmap-legend__bar" />
          <span>Many visits</span>
        </div>
      )}
    </div>
  );
}
