import { useDrawStore } from '../../stores/drawStore';

interface MapControlsProps {
  onFinish: () => void;
}

export function MapControls({ onFinish }: MapControlsProps) {
  const mode = useDrawStore((state) => state.mode);
  const points = useDrawStore((state) => state.points);
  const cancel = useDrawStore((state) => state.cancel);
  const undoLastPoint = useDrawStore((state) => state.undoLastPoint);
  const gpsError = useDrawStore((state) => state.gpsError);

  if (mode === 'none') {
    return null;
  }

  const canFinish = points.length >= 2;
  const canUndo = points.length > 0 && mode !== 'gps';

  const hint =
    mode === 'click'
      ? 'Click to add points. Backspace / Ctrl+Z to undo, Enter to finish, Esc to cancel.'
      : mode === 'freehand'
        ? 'Hold and drag to draw. Release to finish. Backspace / Ctrl+Z to undo.'
        : mode === 'edit'
          ? 'Click to append points to this route. Undo removes the last point. Save when done.'
          : 'Recording GPS. Walk around, then finish and save the track.';

  return (
    <div className="map-controls">
      <span className="map-controls__hint">{hint}</span>
      {mode === 'gps' && (
        <span className="map-controls__status">
          {gpsError ? gpsError : `Recording… ${points.length} points`}
        </span>
      )}
      <div className="map-controls__actions">
        <button type="button" className="btn btn--ghost" onClick={cancel}>
          Cancel
        </button>
        {canUndo && (
          <button type="button" className="btn btn--ghost" onClick={undoLastPoint}>
            Undo last point
          </button>
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
