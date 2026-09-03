import { useEffect, useState } from 'react';
import { calculateDistanceMeters } from '../../lib/geo/distance';
import { formatDistance } from '../../types/route';
import { queryGeoPermission } from '../../lib/geo/geolocation';
import { useDrawStore } from '../../stores/drawStore';
import { useRouteStore } from '../../stores/routeStore';

export function DrawToolbar() {
  const mode = useDrawStore((state) => state.mode);
  const setMode = useDrawStore((state) => state.setMode);
  const cancel = useDrawStore((state) => state.cancel);
  const startGpsRecording = useDrawStore((state) => state.startGpsRecording);
  const heatmapEnabled = useRouteStore((state) => state.heatmapEnabled);
  const toggleHeatmap = useRouteStore((state) => state.toggleHeatmap);
  const [startingGps, setStartingGps] = useState(false);

  useEffect(() => {
    void queryGeoPermission().then((state) => {
      useDrawStore.getState().setGpsPermission(state);
    });
  }, []);

  const handleModeChange = async (nextMode: 'click' | 'freehand' | 'gps') => {
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
      <button
        type="button"
        className={`btn ${mode === 'click' ? 'btn--active' : ''}`}
        onClick={() => void handleModeChange('click')}
      >
        Click
      </button>
      <button
        type="button"
        className={`btn ${mode === 'freehand' ? 'btn--active' : ''}`}
        onClick={() => void handleModeChange('freehand')}
      >
        Freehand
      </button>
      <button
        type="button"
        className={`btn ${mode === 'gps' ? 'btn--active' : ''}`}
        disabled={startingGps}
        onClick={() => void handleModeChange('gps')}
      >
        {startingGps ? 'GPS…' : 'GPS'}
      </button>
      <span className="draw-toolbar__divider" aria-hidden />
      <button
        type="button"
        className={`btn ${heatmapEnabled ? 'btn--active' : ''}`}
        onClick={toggleHeatmap}
      >
        Heatmap
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
      {gpsAccuracy != null && Number.isFinite(gpsAccuracy) ? ` · ±${Math.round(gpsAccuracy)} m` : ''}
    </div>
  );
}
