import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';

export type MapStyleId = 'osm' | 'satellite' | 'hybrid' | 'topo';

export const MAP_STYLE_OPTIONS: Array<{ id: MapStyleId; label: string; hint: string }> = [
  { id: 'osm', label: 'Streets', hint: 'OpenStreetMap' },
  { id: 'satellite', label: 'Satellite', hint: 'Esri imagery' },
  { id: 'hybrid', label: 'Hybrid', hint: 'Satellite + labels' },
  { id: 'topo', label: 'Terrain', hint: 'OpenTopoMap' },
];

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/">CARTO</a>`;
const ESRI_ATTR =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const TOPO_ATTR = `${OSM_ATTR}, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`;

function rasterSource(tiles: string[], attribution: string, maxzoom = 19) {
  return {
    type: 'raster' as const,
    tiles,
    tileSize: 256,
    attribution,
    maxzoom,
  };
}

function withGlobe(style: StyleSpecification, globe: boolean, dark: boolean): StyleSpecification {
  if (!globe) {
    return style;
  }

  return {
    ...style,
    projection: { type: 'globe' },
    sky: dark
      ? {
          'sky-color': '#0b1026',
          'horizon-color': '#5b87c5',
          'fog-color': '#d7e6f5',
        }
      : {
          'sky-color': '#9ec9f0',
          'horizon-color': '#dbeafe',
          'fog-color': '#f8fafc',
        },
  };
}

export function getBasemapStyle(id: MapStyleId, globe = false): StyleSpecification {
  const resolved = MAP_STYLE_OPTIONS.some((option) => option.id === id) ? id : 'osm';
  const dark = resolved === 'satellite' || resolved === 'hybrid';

  if (resolved === 'hybrid') {
    return withGlobe(
      {
        version: 8,
        sources: {
          satellite: rasterSource(
            [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            ESRI_ATTR,
          ),
          labels: rasterSource(
            ['https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png'],
            CARTO_ATTR,
            20,
          ),
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'satellite' },
          {
            id: 'labels',
            type: 'raster',
            source: 'labels',
            minzoom: 5,
            paint: { 'raster-opacity': 0.9 },
          },
        ],
      },
      globe,
      dark,
    );
  }

  const tilesById: Record<
    Exclude<MapStyleId, 'hybrid'>,
    { tiles: string[]; attribution: string; maxzoom?: number }
  > = {
    osm: {
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: OSM_ATTR,
    },
    satellite: {
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      attribution: ESRI_ATTR,
    },
    topo: {
      tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      attribution: TOPO_ATTR,
      maxzoom: 17,
    },
  };

  const spec = tilesById[resolved];
  return withGlobe(
    {
      version: 8,
      sources: {
        basemap: rasterSource(spec.tiles, spec.attribution, spec.maxzoom),
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    },
    globe,
    dark,
  );
}

export function applyBasemapAtmosphere(map: MaplibreMap, id: MapStyleId) {
  const maybeFog = map as MaplibreMap & {
    setFog?: (fog: Record<string, string | number>) => void;
  };
  const dark = id === 'satellite' || id === 'hybrid';

  maybeFog.setFog?.(
    dark
      ? {
          color: 'rgb(186, 210, 235)',
          'high-color': 'rgb(36, 92, 223)',
          'horizon-blend': 0.03,
          'space-color': 'rgb(11, 11, 25)',
          'star-intensity': 0.65,
        }
      : {
          color: 'rgb(220, 232, 245)',
          'high-color': 'rgb(147, 197, 253)',
          'horizon-blend': 0.08,
          'space-color': 'rgb(186, 214, 240)',
          'star-intensity': 0.08,
        },
  );
}
