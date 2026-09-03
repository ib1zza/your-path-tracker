import { useCallback, useEffect, useRef } from 'react';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { useDrawStore } from '../../stores/drawStore';

export function useFreehandDraw(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
  onComplete: () => void,
) {
  const mode = useDrawStore((state) => state.mode);
  const appendPoints = useDrawStore((state) => state.appendPoints);
  const setFreehandActive = useDrawStore((state) => state.setFreehandActive);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<[number, number] | null>(null);

  const handleComplete = useCallback(() => {
    drawingRef.current = false;
    lastPointRef.current = null;
    setFreehandActive(false);
    onComplete();
  }, [onComplete, setFreehandActive]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded || mode !== 'freehand') {
      return;
    }

    const minDistance = 0.00003;

    const addPointIfFarEnough = (lng: number, lat: number) => {
      const last = lastPointRef.current;
      if (last) {
        const dx = lng - last[0];
        const dy = lat - last[1];
        if (dx * dx + dy * dy < minDistance * minDistance) {
          return;
        }
      }
      lastPointRef.current = [lng, lat];
      appendPoints([[lng, lat]]);
    };

    const handleMouseDown = (event: MapLayerMouseEvent) => {
      if (event.originalEvent.button !== 0) return;
      drawingRef.current = true;
      setFreehandActive(true);
      const [lng, lat] = event.lngLat.toArray();
      lastPointRef.current = [lng, lat];
      appendPoints([[lng, lat]]);
      map.dragPan.disable();
    };

    const handleMouseMove = (event: MapLayerMouseEvent) => {
      if (!drawingRef.current) return;
      const [lng, lat] = event.lngLat.toArray();
      addPointIfFarEnough(lng, lat);
    };

    const handleMouseUp = () => {
      if (!drawingRef.current) return;
      map.dragPan.enable();
      handleComplete();
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    map.getCanvas().style.cursor = 'crosshair';

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();
    };
  }, [appendPoints, handleComplete, mapLoaded, mapRef, mode, setFreehandActive]);
}

export function useDrawKeyboard(onFinish: () => void) {
  const mode = useDrawStore((state) => state.mode);
  const points = useDrawStore((state) => state.points);
  const cancel = useDrawStore((state) => state.cancel);
  const undoLastPoint = useDrawStore((state) => state.undoLastPoint);
  const removeSelectedPoint = useDrawStore((state) => state.removeSelectedPoint);

  useEffect(() => {
    if (mode === 'none') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Escape') {
        cancel();
        return;
      }

      const isDelete =
        event.key === 'Backspace' ||
        event.key === 'Delete';

      if (isDelete && mode === 'edit') {
        event.preventDefault();
        removeSelectedPoint();
        return;
      }

      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';

      if ((isUndo || isDelete) && mode !== 'gps' && mode !== 'edit') {
        event.preventDefault();
        undoLastPoint();
        return;
      }

      if (isUndo && mode === 'edit') {
        event.preventDefault();
        undoLastPoint();
        return;
      }

      if (
        event.key === 'Enter' &&
        (mode === 'click' || mode === 'gps' || mode === 'edit') &&
        points.length >= 2
      ) {
        onFinish();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancel, mode, onFinish, points.length, removeSelectedPoint, undoLastPoint]);
}
