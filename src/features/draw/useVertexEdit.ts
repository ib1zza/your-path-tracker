import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { MapMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { useDrawStore } from '../../stores/drawStore';

const POINT_LAYER_ID = 'draw-preview-points';
const HIT_PX = 14;

function findNearestPointIndex(
  map: MaplibreMap,
  point: { x: number; y: number },
  coordinates: [number, number][],
): number | null {
  let bestIndex: number | null = null;
  let bestDist = HIT_PX;

  for (let index = 0; index < coordinates.length; index += 1) {
    const projected = map.project(coordinates[index]);
    const dx = projected.x - point.x;
    const dy = projected.y - point.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= bestDist) {
      bestDist = dist;
      bestIndex = index;
    }
  }

  return bestIndex;
}

/** Drag / select / delete vertices while editing a saved route. */
export function useVertexEdit(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
) {
  const mode = useDrawStore((state) => state.mode);
  const dragIndexRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded || mode !== 'edit') {
      return;
    }

    const canvas = map.getCanvas();
    map.doubleClickZoom.disable();

    const handleMouseDown = (event: MapMouseEvent) => {
      if (event.originalEvent.button !== 0) return;

      const points = useDrawStore.getState().points as [number, number][];
      const index = findNearestPointIndex(map, event.point, points);
      if (index == null) {
        return;
      }

      event.preventDefault();
      dragIndexRef.current = index;
      didDragRef.current = false;
      useDrawStore.getState().selectPoint(index);
      map.dragPan.disable();
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (event: MapMouseEvent) => {
      const dragIndex = dragIndexRef.current;
      if (dragIndex == null) {
        const points = useDrawStore.getState().points as [number, number][];
        const hoverIndex = findNearestPointIndex(map, event.point, points);
        canvas.style.cursor = hoverIndex == null ? 'crosshair' : 'grab';
        return;
      }

      didDragRef.current = true;
      const [lng, lat] = event.lngLat.toArray();
      useDrawStore.getState().updatePoint(dragIndex, [lng, lat]);
    };

    const handleMouseUp = () => {
      if (dragIndexRef.current == null) return;
      dragIndexRef.current = null;
      map.dragPan.enable();
      canvas.style.cursor = 'crosshair';
    };

    const handleClick = (event: MapMouseEvent) => {
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }

      const points = useDrawStore.getState().points as [number, number][];
      const index = findNearestPointIndex(map, event.point, points);
      if (index != null) {
        useDrawStore.getState().selectPoint(index);
        return;
      }

      if (event.originalEvent.shiftKey) {
        useDrawStore.getState().addPoint(event.lngLat.toArray());
      } else {
        useDrawStore.getState().selectPoint(null);
      }
    };

    const handleDblClick = (event: MapMouseEvent) => {
      const points = useDrawStore.getState().points as [number, number][];
      const index = findNearestPointIndex(map, event.point, points);
      if (index == null || points.length <= 2) return;
      event.preventDefault();
      useDrawStore.getState().removePointAt(index);
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);
    canvas.style.cursor = 'crosshair';

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      canvas.style.cursor = '';
      dragIndexRef.current = null;
    };
  }, [mapLoaded, mapRef, mode]);

  const selectedPointIndex = useDrawStore((state) => state.selectedPointIndex);
  const points = useDrawStore((state) => state.points);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded || mode !== 'edit' || !map.getLayer(POINT_LAYER_ID)) {
      return;
    }

    for (let index = 0; index < points.length; index += 1) {
      try {
        map.setFeatureState(
          { source: 'draw-preview', id: index },
          { selected: index === selectedPointIndex },
        );
      } catch {
        // Source may be mid-update.
      }
    }
  }, [mapLoaded, mapRef, mode, points, selectedPointIndex]);
}
