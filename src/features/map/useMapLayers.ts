import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import { fitMapToRoute } from '../../lib/geo/fitBounds';
import { routesToHeatmapPoints } from '../../lib/geo/heatmap';
import { routesGeometryKey } from '../../lib/geo/routeGeometry';
import { useRouteStore } from '../../stores/routeStore';
import type { RouteFeature } from '../../types/route';

export const ROUTES_SOURCE_ID = 'saved-routes';
export const ROUTES_OUTLINE_LAYER_ID = 'saved-routes-outline';
export const ROUTES_LINE_LAYER_ID = 'saved-routes-line';
export const ROUTES_HIT_LAYER_ID = 'saved-routes-hit';
export const HEATMAP_SOURCE_ID = 'routes-heatmap';
export const HEATMAP_LAYER_ID = 'routes-heatmap-layer';

function moveRouteLayersToTop(map: Map) {
  if (map.getLayer(HEATMAP_LAYER_ID)) {
    map.moveLayer(HEATMAP_LAYER_ID);
  }
  if (map.getLayer(ROUTES_HIT_LAYER_ID)) {
    map.moveLayer(ROUTES_HIT_LAYER_ID);
  }
  if (map.getLayer(ROUTES_OUTLINE_LAYER_ID)) {
    map.moveLayer(ROUTES_OUTLINE_LAYER_ID);
  }
  if (map.getLayer(ROUTES_LINE_LAYER_ID)) {
    map.moveLayer(ROUTES_LINE_LAYER_ID);
  }
}

function moveDrawLayersToTop(map: Map) {
  if (map.getLayer('draw-preview-line')) {
    map.moveLayer('draw-preview-line');
  }
  if (map.getLayer('draw-preview-points')) {
    map.moveLayer('draw-preview-points');
  }
}

function syncRoutesGeometry(map: Map, routes: RouteFeature[]) {
  const data = {
    type: 'FeatureCollection' as const,
    features: routes.map((route) => ({
      type: 'Feature' as const,
      id: route.properties.id,
      properties: {
        id: route.properties.id,
        color: route.properties.color,
        name: route.properties.name,
      },
      geometry: route.geometry,
    })),
  };

  const existingSource = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource | undefined;

  if (!existingSource) {
    map.addSource(ROUTES_SOURCE_ID, {
      type: 'geojson',
      data,
      promoteId: 'id',
    });
  } else {
    existingSource.setData(data);
  }

  if (!map.getLayer(ROUTES_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: ROUTES_OUTLINE_LAYER_ID,
      type: 'line',
      source: ROUTES_SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 9, 7],
        'line-opacity': 1,
      },
    });
  }

  if (!map.getLayer(ROUTES_LINE_LAYER_ID)) {
    map.addLayer({
      id: ROUTES_LINE_LAYER_ID,
      type: 'line',
      source: ROUTES_SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 6, 4],
        'line-opacity': 1,
      },
    });
  }

  if (!map.getLayer(ROUTES_HIT_LAYER_ID)) {
    map.addLayer({
      id: ROUTES_HIT_LAYER_ID,
      type: 'line',
      source: ROUTES_SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#000000',
        'line-width': 22,
        'line-opacity': 0,
      },
    });
  }

  moveRouteLayersToTop(map);
  moveDrawLayersToTop(map);
}

function syncRouteSelection(
  map: Map,
  selectedId: string | null,
  previousSelectedId: string | null,
) {
  if (!map.getSource(ROUTES_SOURCE_ID)) {
    return;
  }

  if (previousSelectedId && previousSelectedId !== selectedId) {
    try {
      map.setFeatureState(
        { source: ROUTES_SOURCE_ID, id: previousSelectedId },
        { selected: false },
      );
    } catch {
      // Feature may have been removed.
    }
  }

  if (selectedId) {
    try {
      map.setFeatureState({ source: ROUTES_SOURCE_ID, id: selectedId }, { selected: true });
    } catch {
      // Feature may not exist yet.
    }
  }
}

export function queryRouteIdAtPoint(map: Map, point: { x: number; y: number }): string | null {
  const pad = 10;
  const layers = [ROUTES_HIT_LAYER_ID, ROUTES_LINE_LAYER_ID, ROUTES_OUTLINE_LAYER_ID].filter((id) =>
    Boolean(map.getLayer(id)),
  );
  if (layers.length === 0) {
    return null;
  }

  const hits = map.queryRenderedFeatures(
    [
      [point.x - pad, point.y - pad],
      [point.x + pad, point.y + pad],
    ],
    { layers },
  );
  const hit = hits.find((feature) => feature.properties?.id);
  return hit?.properties?.id != null ? String(hit.properties.id) : null;
}

export function useRoutesLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  routes: RouteFeature[],
  selectedId: string | null,
  heatmapEnabled = false,
) {
  const geometryKeyRef = useRef('');
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) {
      return;
    }

    const sync = () => {
      const nextKey = routesGeometryKey(routes);
      const sourceMissing = !map.getSource(ROUTES_SOURCE_ID);
      if (sourceMissing || geometryKeyRef.current !== nextKey) {
        syncRoutesGeometry(map, routes);
        geometryKeyRef.current = nextKey;
        selectedIdRef.current = null;
      }

      if (selectedIdRef.current !== selectedId) {
        syncRouteSelection(map, selectedId, selectedIdRef.current);
        selectedIdRef.current = selectedId;
      }

      if (map.getLayer(ROUTES_LINE_LAYER_ID)) {
        map.setPaintProperty(ROUTES_LINE_LAYER_ID, 'line-opacity', heatmapEnabled ? 0.22 : 1);
        map.setPaintProperty(
          ROUTES_LINE_LAYER_ID,
          'line-width',
          heatmapEnabled ? 2 : ['case', ['boolean', ['feature-state', 'selected'], false], 6, 4],
        );
      }
      if (map.getLayer(ROUTES_OUTLINE_LAYER_ID)) {
        map.setPaintProperty(ROUTES_OUTLINE_LAYER_ID, 'line-opacity', heatmapEnabled ? 0 : 0.9);
      }
    };

    sync();
    map.on('style.load', sync);
    return () => {
      map.off('style.load', sync);
    };
  }, [heatmapEnabled, mapLoaded, mapRef, routes, selectedId]);
}

export function useHeatmapLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  routes: RouteFeature[],
  enabled: boolean,
) {
  const geometryKeyRef = useRef('');

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) {
      return;
    }

    const sync = () => {
    const nextKey = enabled ? routesGeometryKey(routes) : '';
    const shouldUpdateData = enabled && geometryKeyRef.current !== nextKey;
    const data = enabled
      ? shouldUpdateData || !map.getSource(HEATMAP_SOURCE_ID)
        ? routesToHeatmapPoints(routes)
        : null
      : { type: 'FeatureCollection' as const, features: [] };

    if (shouldUpdateData) {
      geometryKeyRef.current = nextKey;
    }
    if (!enabled) {
      geometryKeyRef.current = '';
    }

    const existingSource = map.getSource(HEATMAP_SOURCE_ID) as GeoJSONSource | undefined;

    if (!existingSource) {
      map.addSource(HEATMAP_SOURCE_ID, {
        type: 'geojson',
        data: data ?? { type: 'FeatureCollection', features: [] },
      });
    } else if (data) {
      existingSource.setData(data);
    }

    if (!map.getLayer(HEATMAP_LAYER_ID)) {
      map.addLayer(
        {
          id: HEATMAP_LAYER_ID,
          type: 'heatmap',
          source: HEATMAP_SOURCE_ID,
          paint: {
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'visits'],
              1,
              0.12,
              2,
              0.4,
              3,
              0.7,
              5,
              1,
            ],
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8,
              0.35,
              12,
              0.45,
              16,
              0.55,
              19,
              0.65,
            ],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(0,0,0,0)',
              0.08,
              'rgba(29,78,216,0.15)',
              0.22,
              'rgb(59,130,246)',
              0.4,
              'rgb(34,197,94)',
              0.55,
              'rgb(250,204,21)',
              0.72,
              'rgb(249,115,22)',
              0.88,
              'rgb(220,38,38)',
              1,
              'rgb(127,29,29)',
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              10,
              13,
              18,
              15,
              28,
              17,
              46,
              19,
              72,
            ],
            'heatmap-opacity': 0.9,
          },
        },
        map.getLayer(ROUTES_OUTLINE_LAYER_ID) ? ROUTES_OUTLINE_LAYER_ID : undefined,
      );
    }

    map.setLayoutProperty(HEATMAP_LAYER_ID, 'visibility', enabled ? 'visible' : 'none');
    map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-opacity', enabled ? 0.9 : 0);
    moveRouteLayersToTop(map);
    moveDrawLayersToTop(map);
    };

    sync();
    map.on('style.load', sync);
    return () => {
      map.off('style.load', sync);
    };
  }, [enabled, mapLoaded, mapRef, routes]);
}

export function useDrawPreviewLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  points: [number, number][],
  selectedPointIndex: number | null = null,
  editMode = false,
) {
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) {
      return;
    }

    const sourceId = 'draw-preview';
    const lineLayerId = 'draw-preview-line';
    const pointLayerId = 'draw-preview-points';

    const lineFeatures =
      points.length >= 2
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'LineString' as const,
                coordinates: points,
              },
            },
          ]
        : [];

    const data = {
      type: 'FeatureCollection' as const,
      features: [
        ...lineFeatures,
        ...points.map((coordinate, index) => ({
          type: 'Feature' as const,
          id: index,
          properties: { index, id: index },
          geometry: {
            type: 'Point' as const,
            coordinates: coordinate,
          },
        })),
      ],
    };

    const existingSource = map.getSource(sourceId) as GeoJSONSource | undefined;

    if (!existingSource) {
      map.addSource(sourceId, {
        type: 'geojson',
        data,
        promoteId: 'id',
      });
    } else {
      existingSource.setData(data);
    }

    if (!map.getLayer(lineLayerId)) {
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ff5722',
          'line-width': 5,
          'line-opacity': 1,
        },
      });
    }

    if (!map.getLayer(pointLayerId)) {
      map.addLayer({
        id: pointLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            9,
            editMode ? 6 : 5,
          ],
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#2563eb',
            '#ff5722',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1,
        },
      });
    } else {
      map.setPaintProperty(pointLayerId, 'circle-radius', [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        9,
        editMode ? 6 : 5,
      ]);
    }

    if (editMode) {
      for (let index = 0; index < points.length; index += 1) {
        try {
          map.setFeatureState(
            { source: sourceId, id: index },
            { selected: index === selectedPointIndex },
          );
        } catch {
          // ignore
        }
      }
    }

    moveDrawLayersToTop(map);
  }, [editMode, mapLoaded, mapRef, points, selectedPointIndex]);
}

export function useFitRouteOnSelect(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  selectedId: string | null,
) {
  useEffect(() => {
    if (!mapLoaded || !selectedId) {
      return;
    }

    const map = mapRef.current?.getMap();
    const route = useRouteStore.getState().routes.find((item) => item.properties.id === selectedId);
    if (!map || !route) {
      return;
    }

    fitMapToRoute(map, route);
  }, [mapLoaded, mapRef, selectedId]);
}
