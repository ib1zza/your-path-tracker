import { useMapUiStore } from '../../stores/mapUiStore';
import { useRouteStore } from '../../stores/routeStore';
import { MapStyleMenu } from './MapStyleMenu';

export function GlobeToolbar() {
  const heatmapEnabled = useRouteStore((state) => state.heatmapEnabled);
  const toggleHeatmap = useRouteStore((state) => state.toggleHeatmap);
  const showMyLocation = useMapUiStore((state) => state.showMyLocation);
  const locateMe = useMapUiStore((state) => state.locateMe);
  const globeStyleId = useMapUiStore((state) => state.globeStyleId);
  const setGlobeStyleId = useMapUiStore((state) => state.setGlobeStyleId);

  return (
    <div className="draw-toolbar">
      <MapStyleMenu value={globeStyleId} onChange={setGlobeStyleId} />
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
