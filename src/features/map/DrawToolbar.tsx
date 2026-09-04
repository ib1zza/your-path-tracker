import { useEffect, useState } from 'react';
import { calculateDistanceMeters } from '../../lib/geo/distance';
import { formatDistance } from '../../types/route';
import { queryGeoPermission } from '../../lib/geo/geolocation';
import { useDrawStore } from '../../stores/drawStore';
import { useMapUiStore } from '../../stores/mapUiStore';
import { useRouteStore } from '../../stores/routeStore';
import { MapStyleMenu } from './MapStyleMenu';

const NEW_ROUTE_OPTIONS = [
  {
    mode: 'click' as const,
    label: 'Click',
    hint: 'Tap the map to add points',
  },
  {
    mode: 'freehand' as const,
    label: 'Freehand',
    hint: 'Draw a path by dragging',
  },
  {
    mode: 'gps' as const,
    label: 'GPS',
    hint: 'Record while you walk',
  },
];

export function DrawToolbar() {
  const mode = useDrawStore((state) => state.mode);
  const setMode = useDrawStore((state) => state.setMode);
  const cancel = useDrawStore((state) => state.cancel);
  const startGpsRecording = useDrawStore((state) => state.startGpsRecording);
  const heatmapEnabled = useRouteStore((state) => state.heatmapEnabled);
  const toggleHeatmap = useRouteStore((state) => state.toggleHeatmap);
  const showMyLocation = useMapUiStore((state) => state.showMyLocation);
  const locateMe = useMapUiStore((state) => state.locateMe);
  const mapStyleId = useMapUiStore((state) => state.mapStyleId);
  const setMapStyleId = useMapUiStore((state) => state.setMapStyleId);
  const [startingGps, setStartingGps] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isDrawing = mode === 'click' || mode === 'freehand' || mode === 'gps';
  const activeLabel = NEW_ROUTE_OPTIONS.find((option) => option.mode === mode)?.label;

  useEffect(() => {
    void queryGeoPermission().then((state) => {
      useDrawStore.getState().setGpsPermission(state);
    });
  }, []);

  const handleModeChange = async (nextMode: 'click' | 'freehand' | 'gps') => {
    setMenuOpen(false);

    if (mode === nextMode) {
      cancel();
      return;
    }

    if (nextMode === 'gps') {
      setStartingGps(true);
      const ok = await startGpsRecording();
      setStartingGps(false);
      if (!ok) return;
      return;
    }

    setMode(nextMode);
  };

  return (
    <div className="draw-toolbar">
      <div className="draw-menu">
        <button
          type="button"
          className={`btn ${isDrawing ? 'btn--active' : ''}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          disabled={startingGps}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {startingGps ? 'GPS…' : activeLabel ?? 'New route'}
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="draw-menu__backdrop"
              aria-label="Close new route menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="draw-menu__list" role="menu">
              {NEW_ROUTE_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  className={`draw-menu__item ${mode === option.mode ? 'draw-menu__item--active' : ''}`}
                  role="menuitem"
                  onClick={() => void handleModeChange(option.mode)}
                >
                  <span>{option.label}</span>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <span className="draw-toolbar__divider" aria-hidden />
      <MapStyleMenu value={mapStyleId} onChange={setMapStyleId} />
      <span className="draw-toolbar__divider" aria-hidden />
      <button
        type="button"
        className={`btn ${heatmapEnabled ? 'btn--active' : ''}`}
        onClick={toggleHeatmap}
      >
        Heatmap
      </button>
      <span className="draw-toolbar__divider" aria-hidden />
      <button
        type="button"
        className={`btn ${showMyLocation ? 'btn--active' : ''}`}
        onClick={locateMe}
      >
        My location
      </button>
    </div>
  );
}

export function GpsStatusBadge() {
  const mode = useDrawStore((state) => state.mode);
  const points = useDrawStore((state) => state.points);
  const gpsPaused = useDrawStore((state) => state.gpsPaused);
  const gpsAccuracy = useDrawStore((state) => state.gpsAccuracy);

  if (mode !== 'gps') return null;

  const distance =
    points.length >= 2
      ? formatDistance(calculateDistanceMeters({ type: 'LineString', coordinates: points }))
      : '0 m';

  return (
    <div className={`gps-badge ${gpsPaused ? 'gps-badge--paused' : ''}`}>
      <span className="gps-badge__dot" />
      {gpsPaused ? 'Paused' : 'Recording'} · {points.length} pts · {distance}
      {gpsAccuracy != null && Number.isFinite(gpsAccuracy)
        ? ` · ±${Math.round(gpsAccuracy)} m`
        : ''}
    </div>
  );
}
