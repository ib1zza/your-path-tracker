import { calculateDistanceMeters } from '../../lib/geo/distance';
import { formatDistance } from '../../types/route';
import { useDrawStore } from '../../stores/drawStore';
import { useState } from 'react';

interface MapControlsProps {
  onFinish: () => void;
  onSplit: () => void;
}

export function MapControls({ onFinish, onSplit }: MapControlsProps) {
  const mode = useDrawStore((state) => state.mode);
  const points = useDrawStore((state) => state.points);
  const selectedPointIndex = useDrawStore((state) => state.selectedPointIndex);
  const cancel = useDrawStore((state) => state.cancel);
  const undoLastPoint = useDrawStore((state) => state.undoLastPoint);
  const removeSelectedPoint = useDrawStore((state) => state.removeSelectedPoint);
  const addPointAfterSelected = useDrawStore((state) => state.addPointAfterSelected);
  const cleanGpsSpikes = useDrawStore((state) => state.cleanGpsSpikes);
  const gpsError = useDrawStore((state) => state.gpsError);
  const gpsPaused = useDrawStore((state) => state.gpsPaused);
  const gpsFollow = useDrawStore((state) => state.gpsFollow);
  const gpsPermission = useDrawStore((state) => state.gpsPermission);
  const gpsAccuracy = useDrawStore((state) => state.gpsAccuracy);
  const pauseGps = useDrawStore((state) => state.pauseGps);
  const resumeGps = useDrawStore((state) => state.resumeGps);
  const setGpsFollow = useDrawStore((state) => state.setGpsFollow);
  const startGpsRecording = useDrawStore((state) => state.startGpsRecording);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);

  if (mode === 'none') {
    return null;
  }

  const canFinish = points.length >= 2;
  const canUndo = points.length > 0 && mode !== 'gps';
  const distance =
    points.length >= 2
      ? formatDistance(calculateDistanceMeters({ type: 'LineString', coordinates: points }))
      : '0 m';

  const hint =
    mode === 'click'
      ? 'Click to add points. Backspace / Ctrl+Z to undo, Enter to finish, Esc to cancel.'
      : mode === 'freehand'
        ? 'Hold and drag to draw. Release to finish. Backspace / Ctrl+Z to undo.'
        : mode === 'edit'
          ? 'Drag points to move. Add/Delete act on the selected point (or the last one). Double-click deletes. Shift+click adds. Clean spikes removes GPS jumps.'
          : 'Keep this tab open while walking. Location stays allowed after the first grant.';

  const handleCleanSpikes = () => {
    const removed = cleanGpsSpikes();
    setCleanMessage(
      removed > 0 ? `Removed ${removed} spike point${removed === 1 ? '' : 's'}` : 'No spikes found',
    );
    window.setTimeout(() => setCleanMessage(null), 2500);
  };

  return (
    <div className="map-controls">
      <span className="map-controls__hint">{hint}</span>

      {mode === 'edit' && (
        <div className="edit-panel">
          <div className="edit-panel__row">
            <strong>Editing path</strong>
            <span>
              {points.length} pts · {distance}
              {selectedPointIndex != null ? ` · point #${selectedPointIndex + 1}` : ''}
            </span>
          </div>
          {cleanMessage && <p className="edit-panel__note">{cleanMessage}</p>}
        </div>
      )}

      {mode === 'gps' && (
        <div className="gps-panel">
          <div className="gps-panel__row">
            <strong>{gpsPaused ? 'Paused' : 'Live GPS'}</strong>
            <span>
              {points.length} pts · {distance}
              {gpsAccuracy != null && Number.isFinite(gpsAccuracy)
                ? ` · ±${Math.round(gpsAccuracy)} m`
                : ''}
            </span>
          </div>
          {gpsError ? (
            <p className="gps-panel__error">{gpsError}</p>
          ) : (
            <p className="gps-panel__note">
              {gpsPermission === 'granted'
                ? 'Location access granted. Track is autosaved if the page reloads.'
                : 'Browser will ask for location access. Choose “Allow while using the app”.'}
            </p>
          )}
          {gpsPermission === 'denied' && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void startGpsRecording()}
            >
              Request location again
            </button>
          )}
        </div>
      )}

      <div className="map-controls__actions">
        <button type="button" className="btn btn--ghost" onClick={cancel}>
          Cancel
        </button>
        {mode === 'edit' && (
          <>
            <button type="button" className="btn btn--ghost" onClick={addPointAfterSelected}>
              {selectedPointIndex != null ? 'Add point' : 'Add last point'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={points.length <= 2}
              onClick={removeSelectedPoint}
            >
              {selectedPointIndex != null ? 'Delete point' : 'Delete last point'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleCleanSpikes}>
              Clean spikes
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={
                selectedPointIndex == null ||
                selectedPointIndex < 1 ||
                selectedPointIndex > points.length - 2
              }
              onClick={onSplit}
            >
              Split here
            </button>
          </>
        )}
        {canUndo && mode !== 'edit' && (
          <button type="button" className="btn btn--ghost" onClick={undoLastPoint}>
            Undo last point
          </button>
        )}
        {mode === 'gps' && (
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => (gpsPaused ? resumeGps() : pauseGps())}
            >
              {gpsPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className={`btn ${gpsFollow ? 'btn--active' : 'btn--ghost'}`}
              onClick={() => setGpsFollow(!gpsFollow)}
            >
              Follow
            </button>
          </>
        )}
        {(mode === 'click' || mode === 'gps' || mode === 'edit') && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canFinish}
            onClick={onFinish}
          >
            {mode === 'edit' ? 'Save edits' : 'Finish route'}
          </button>
        )}
      </div>
    </div>
  );
}
