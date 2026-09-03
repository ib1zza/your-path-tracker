import { MAP_STYLES, type MapStyleId } from './mapConfig';
import { useDrawStore } from '../../stores/drawStore';
import { useRouteStore } from '../../stores/routeStore';

export function DrawToolbar() {
  const mode = useDrawStore((state) => state.mode);
  const setMode = useDrawStore((state) => state.setMode);
  const cancel = useDrawStore((state) => state.cancel);
  const heatmapEnabled = useRouteStore((state) => state.heatmapEnabled);
  const toggleHeatmap = useRouteStore((state) => state.toggleHeatmap);
  const mapStyleId = useRouteStore((state) => state.mapStyleId);
  const setMapStyleId = useRouteStore((state) => state.setMapStyleId);

  const handleModeChange = (nextMode: 'click' | 'freehand' | 'gps') => {
    if (mode === nextMode) {
      cancel();
      return;
    }
    setMode(nextMode);
  };

  return (
    <div className="draw-toolbar">
      <button
        type="button"
        className={`btn ${mode === 'click' ? 'btn--active' : ''}`}
        onClick={() => handleModeChange('click')}
      >
        Click
      </button>
      <button
        type="button"
        className={`btn ${mode === 'freehand' ? 'btn--active' : ''}`}
        onClick={() => handleModeChange('freehand')}
      >
        Freehand
      </button>
      <button
        type="button"
        className={`btn ${mode === 'gps' ? 'btn--active' : ''}`}
        onClick={() => handleModeChange('gps')}
      >
        GPS
      </button>
      <span className="draw-toolbar__divider" aria-hidden />
      <button
        type="button"
        className={`btn ${heatmapEnabled ? 'btn--active' : ''}`}
        onClick={toggleHeatmap}
      >
        Heatmap
      </button>
      <select
        className="draw-toolbar__select"
        value={mapStyleId}
        onChange={(event) => setMapStyleId(event.target.value as MapStyleId)}
        aria-label="Map style"
      >
        {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => (
          <option key={id} value={id}>
            {MAP_STYLES[id].label}
          </option>
        ))}
      </select>
    </div>
  );
}
