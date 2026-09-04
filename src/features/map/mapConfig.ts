import { getBasemapStyle } from '../../lib/map/basemapStyles';

export {
  applyBasemapAtmosphere,
  getBasemapStyle,
  MAP_STYLE_OPTIONS,
  type MapStyleId,
} from '../../lib/map/basemapStyles';

export const OSM_MAP_STYLE = getBasemapStyle('osm');

export const DEFAULT_MAP_VIEW = {
  longitude: 37.6173,
  latitude: 55.7558,
  zoom: 10,
};
