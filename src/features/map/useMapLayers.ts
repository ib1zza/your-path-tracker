import { useEffect } from 'react';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import { fitMapToRoute } from '../../lib/geo/fitBounds';
import { routesToHeatmapPoints } from '../../lib/geo/heatmap';
import { useRouteStore } from '../../stores/routeStore';
import type { RouteFeature } from '../../types/route';

export const ROUTES_SOURCE_ID = 'saved-routes';
export const ROUTES_OUTLINE_LAYER_ID = 'saved-routes-outline';
export const ROUTES_LINE_LAYER_ID = 'saved-routes-line';
export const HEATMAP_SOURCE_ID = 'routes-heatmap';
export const HEATMAP_LAYER_ID = 'routes-heatmap-layer';

function moveRouteLayersToTop(map: Map) {
  if (map.getLayer(HEATMAP_LAYER_ID)) {
    map.moveLayer(HEATMAP_LAYER_ID);
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

function syncRoutesLayer(map: Map, routes: RouteFeature[], selectedId: string | null) {
  const data = {
    type: 'FeatureCollection' as const,
    features: routes.map((route) => ({
      type: 'Feature' as const,
      properties: {
        ...route.properties,
        isSelected: route.properties.id === selectedId ? 1 : 0,
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
        'line-width': [
          'case',
          ['==', ['get', 'isSelected'], 1],
          9,
          7,
        ],
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
        'line-width': [
          'case',
          ['==', ['get', 'isSelected'], 1],
          6,
          4,
        ],
        'line-opacity': 1,
      },
    });
  }

  moveRouteLayersToTop(map);
  moveDrawLayersToTop(map);
}

export function useRoutesLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  routes: RouteFeature[],
  selectedId: string | null,
  heatmapEnabled = false,
) {
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) {
      return;
    }

    syncRoutesLayer(map, routes, selectedId);

    if (map.getLayer(ROUTES_LINE_LAYER_ID)) {
      map.setPaintProperty(ROUTES_LINE_LAYER_ID, 'line-opacity', heatmapEnabled ? 0.22 : 1);
      map.setPaintProperty(ROUTES_LINE_LAYER_ID, 'line-width', heatmapEnabled ? 2 : [
        'case',
        ['==', ['get', 'isSelected'], 1],
        6,
        4,
      ]);
    }
    if (map.getLayer(ROUTES_OUTLINE_LAYER_ID)) {
      map.setPaintProperty(ROUTES_OUTLINE_LAYER_ID, 'line-opacity', heatmapEnabled ? 0 : 0.9);
    }
  }, [heatmapEnabled, mapLoaded, mapRef, routes, selectedId]);
}

export function useHeatmapLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  routes: RouteFeature[],
  enabled: boolean,
) {
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) {
      return;
    }

    const data = enabled ? routesToHeatmapPoints(routes) : { type: 'FeatureCollection' as const, features: [] };
    const existingSource = map.getSource(HEATMAP_SOURCE_ID) as GeoJSONSource | undefined;

    if (!existingSource) {
      map.addSource(HEATMAP_SOURCE_ID, {
        type: 'geojson',
        data,
      });
    } else {
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
    } else {
      map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-weight', [
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
      ]);
      map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-intensity', [
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
      ]);
      map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-radius', [
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
      ]);
    }

    map.setLayoutProperty(HEATMAP_LAYER_ID, 'visibility', enabled ? 'visible' : 'none');
    map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-opacity', enabled ? 0.9 : 0);
    moveRouteLayersToTop(map);
    moveDrawLayersToTop(map);
  }, [enabled, mapLoaded, mapRef, routes]);
}

export function useDrawPreviewLayer(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  points: [number, number][],
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
          properties: { index },
          geometry: {
            type: 'Point' as const,
            coordinates: coordinate,
          },
        })),
      ],
    };

    const existingSource = map.getSource(sourceId) as GeoJSONSource | undefined;

    if (!existingSource) {
      map.addSource(sourceId, { type: 'geojson', data });
    } else {
      existingSource.setData(data);
    }

    if (!map.getLayer(lineLayerId)) {
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
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
          'circle-radius': 6,
          'circle-color': '#ff5722',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1,
        },
      });
    }

    moveDrawLayersToTop(map);
  }, [mapLoaded, mapRef, points]);
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
    const route = useRouteStore
      .getState()
      .routes.find((item) => item.properties.id === selectedId);
    if (!map || !route) {
      return;
    }

    fitMapToRoute(map, route);
  }, [mapLoaded, mapRef, selectedId]);
}
