import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Map, { type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { calculateDistanceMeters } from '../../lib/geo/distance';
import { fitMapToRoute } from '../../lib/geo/fitBounds';
import { resolveRoutePlaceName } from '../../lib/geo/geocode';
import { routeCentroid } from '../../lib/geo/globe';
import { routesGeometryKey } from '../../lib/geo/routeGeometry';
import { simplifyLine } from '../../lib/geo/simplify';
import { useDrawStore } from '../../stores/drawStore';
import { useRouteStore } from '../../stores/routeStore';
import { pickRouteColor } from '../../types/route';
import { useDrawKeyboard, useFreehandDraw } from '../draw/useDrawHandlers';
import { useGpsDraw } from '../draw/useGpsDraw';
import { useVertexEdit } from '../draw/useVertexEdit';
import { DEFAULT_MAP_VIEW, MAP_STYLES } from './mapConfig';
import { MapControls } from './MapControls';
import { PlaceSearch } from './PlaceSearch';
import {
  ROUTES_HIT_LAYER_ID,
  ROUTES_LINE_LAYER_ID,
  ROUTES_OUTLINE_LAYER_ID,
  useDrawPreviewLayer,
  useFitRouteOnSelect,
  useHeatmapLayer,
  useRoutesLayer,
} from './useMapLayers';

interface SaveDialogState {
  open: boolean;
  defaultName: string;
}

export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [saveDialog, setSaveDialog] = useState<SaveDialogState>({
    open: false,
    defaultName: '',
  });
  const [routeName, setRouteName] = useState('');
  const [routeNotes, setRouteNotes] = useState('');

  const routes = useRouteStore((state) => state.routes);
  const selectedId = useRouteStore((state) => state.selectedId);
  const hiddenIds = useRouteStore((state) => state.hiddenIds);
  const heatmapEnabled = useRouteStore((state) => state.heatmapEnabled);
  const mapStyleId = useRouteStore((state) => state.mapStyleId);
  const addRoute = useRouteStore((state) => state.addRoute);
  const updateRoute = useRouteStore((state) => state.updateRoute);
  const selectRoute = useRouteStore((state) => state.selectRoute);

  const mode = useDrawStore((state) => state.mode);
  const points = useDrawStore((state) => state.points);
  const editingRouteId = useDrawStore((state) => state.editingRouteId);
  const selectedPointIndex = useDrawStore((state) => state.selectedPointIndex);
  const addPoint = useDrawStore((state) => state.addPoint);
  const resetDraw = useDrawStore((state) => state.reset);
  const cancelDraw = useDrawStore((state) => state.cancel);
  const setMode = useDrawStore((state) => state.setMode);
  const pauseGps = useDrawStore((state) => state.pauseGps);
  const clearGpsSession = useDrawStore((state) => state.clearGpsSession);

  const geometryKey = useMemo(() => routesGeometryKey(routes), [routes]);

  const visibleRoutes = useMemo(() => {
    return routes.filter((route) => {
      if (hiddenIds.has(route.properties.id)) return false;
      // While editing, the live preview replaces the saved geometry.
      if (editingRouteId && route.properties.id === editingRouteId) return false;
      // Focus selected route: temporarily hide the rest.
      if (selectedId && route.properties.id !== selectedId) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRouteId, geometryKey, hiddenIds, selectedId]);

  const drawPoints = useMemo(
    () => points.map((point) => [point[0], point[1]] as [number, number]),
    [points],
  );

  useRoutesLayer(mapRef, mapLoaded, visibleRoutes, selectedId, heatmapEnabled);
  useHeatmapLayer(mapRef, mapLoaded, visibleRoutes, heatmapEnabled);
  useDrawPreviewLayer(
    mapRef,
    mapLoaded,
    drawPoints,
    selectedPointIndex,
    mode === 'edit',
  );
  useFitRouteOnSelect(mapRef, mapLoaded, selectedId);

  const openSaveDialog = useCallback(() => {
    const state = useDrawStore.getState();
    if (state.points.length < 2) return;

    if (state.mode === 'gps' && !state.gpsPaused) {
      pauseGps();
    }

    if (state.mode === 'edit' && state.editingRouteId) {
      const existing = useRouteStore
        .getState()
        .routes.find((route) => route.properties.id === state.editingRouteId);
      if (!existing) return;

      const geometry = {
        type: 'LineString' as const,
        coordinates: state.points,
      };
      void updateRoute({
        ...existing,
        properties: {
          ...existing.properties,
          updatedAt: new Date().toISOString(),
          distanceMeters: calculateDistanceMeters(geometry),
        },
        geometry,
      }).then(() => {
        selectRoute(existing.properties.id);
        const map = mapRef.current?.getMap();
        if (map) {
          fitMapToRoute(map, { ...existing, geometry });
        }
        cancelDraw();
      });
      return;
    }

    const now = new Date();
    const prefix = state.mode === 'gps' ? 'GPS' : 'Walk';
    setRouteName(
      `${prefix} ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    );
    setRouteNotes('');
    setSaveDialog({ open: true, defaultName: prefix });
  }, [cancelDraw, pauseGps, selectRoute, updateRoute]);

  const handleFreehandComplete = useCallback(() => {
    if (useDrawStore.getState().points.length < 2) {
      useDrawStore.getState().reset();
      return;
    }
    openSaveDialog();
  }, [openSaveDialog]);

  useFreehandDraw(mapRef, mapLoaded, handleFreehandComplete);
  useGpsDraw(mapRef, mapLoaded);
  useVertexEdit(mapRef, mapLoaded);
  useDrawKeyboard(openSaveDialog);

  useEffect(() => {
    setMapLoaded(false);
  }, [mapStyleId]);

  const handleSaveRoute = async () => {
    const { mode: currentMode, points: currentPoints } = useDrawStore.getState();
    const simplified =
      currentMode === 'freehand' ? simplifyLine(currentPoints) : currentPoints;

    if (!Array.isArray(simplified) || simplified.length < 2) {
      return;
    }

    const now = new Date().toISOString();
    const geometry = {
      type: 'LineString' as const,
      coordinates: simplified,
    };

    const tempRoute: import('../../types/route').RouteFeature = {
      type: 'Feature',
      properties: {
        id: uuidv4(),
        name: routeName.trim() || saveDialog.defaultName,
        createdAt: now,
        updatedAt: now,
        color: pickRouteColor(routes.length),
        notes: routeNotes.trim() || undefined,
        source: currentMode === 'gps' ? 'gps' : 'draw',
        distanceMeters: calculateDistanceMeters(geometry),
      },
      geometry,
    };

    const center = routeCentroid(tempRoute);
    if (center) {
      try {
        const placeName = await resolveRoutePlaceName(center[0], center[1]);
        if (placeName) {
          tempRoute.properties.placeName = placeName;
        }
      } catch {
        // ignore geocode errors on save
      }
    }

    await addRoute(tempRoute);
    selectRoute(tempRoute.properties.id);

    const map = mapRef.current?.getMap();
    if (map) {
      fitMapToRoute(map, tempRoute);
    }

    if (currentMode === 'gps') {
      await clearGpsSession();
    }

    setSaveDialog({ open: false, defaultName: '' });
    setRouteName('');
    setRouteNotes('');
    resetDraw();
    setMode('none');
  };

  const handleCancelSave = () => {
    setSaveDialog({ open: false, defaultName: '' });
    setRouteName('');
    setRouteNotes('');
    if (useDrawStore.getState().mode === 'gps') {
      useDrawStore.getState().resumeGps();
      return;
    }
    cancelDraw();
  };

  const handleMapClick = (event: {
    point: { x: number; y: number };
    lngLat: { toArray: () => [number, number] };
    features?: Array<{ layer?: { id?: string }; properties?: Record<string, unknown> }>;
  }) => {
    if (mode === 'click') {
      addPoint(event.lngLat.toArray());
      return;
    }

    if (mode === 'edit') {
      // Vertex editing is handled by useVertexEdit.
      return;
    }

    if (mode !== 'none') {
      return;
    }

    const map = mapRef.current?.getMap();
    let routeId: string | null = null;

    if (map) {
      const pad = 10;
      const layers = [ROUTES_HIT_LAYER_ID, ROUTES_LINE_LAYER_ID, ROUTES_OUTLINE_LAYER_ID].filter(
        (id) => Boolean(map.getLayer(id)),
      );
      if (layers.length > 0) {
        const hits = map.queryRenderedFeatures(
          [
            [event.point.x - pad, event.point.y - pad],
            [event.point.x + pad, event.point.y + pad],
          ],
          { layers },
        );
        const hit = hits.find((feature) => feature.properties?.id);
        if (hit?.properties?.id != null) {
          routeId = String(hit.properties.id);
        }
      }
    }

    if (!routeId) {
      const feature = event.features?.find(
        (item) =>
          item.layer?.id === ROUTES_LINE_LAYER_ID || item.layer?.id === ROUTES_OUTLINE_LAYER_ID,
      );
      if (feature?.properties?.id != null) {
        routeId = String(feature.properties.id);
      }
    }

    selectRoute(routeId);
  };

  return (
    <div className="map-view">
      <Map
        ref={mapRef}
        key={mapStyleId}
        initialViewState={DEFAULT_MAP_VIEW}
        mapStyle={MAP_STYLES[mapStyleId].style}
        style={{ width: '100%', height: '100%' }}
        dragPan={mode !== 'freehand'}
        onLoad={() => setMapLoaded(true)}
        onClick={handleMapClick}
        interactiveLayerIds={
          mode === 'none'
            ? [ROUTES_HIT_LAYER_ID, ROUTES_LINE_LAYER_ID, ROUTES_OUTLINE_LAYER_ID]
            : undefined
        }
        cursor={
          mode === 'click' || mode === 'freehand'
            ? 'crosshair'
            : mode === 'edit'
              ? 'crosshair'
              : 'grab'
        }
      />

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
                zoom: 13,
                duration: 900,
              });
            }
          }}
        />
      </div>

      <MapControls onFinish={openSaveDialog} />

      {heatmapEnabled && (
        <div className="heatmap-legend">
          <span>1 visit</span>
          <div className="heatmap-legend__bar" />
          <span>Many visits</span>
        </div>
      )}

      {saveDialog.open && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="save-route-title">
            <h2 id="save-route-title">
              {editingRouteId ? 'Save edits' : 'Save route'}
            </h2>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={routeName}
                onChange={(event) => setRouteName(event.target.value)}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleSaveRoute();
                  }
                }}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={3}
                value={routeNotes}
                onChange={(event) => setRouteNotes(event.target.value)}
                placeholder="Optional notes"
              />
            </label>
            <p className="modal__meta">
              Points: {points.length} · Distance:{' '}
              {calculateDistanceMeters({ type: 'LineString', coordinates: points }).toFixed(0)} m
            </p>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={handleCancelSave}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void handleSaveRoute()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
