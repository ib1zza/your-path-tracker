import type { StyleSpecification } from 'maplibre-gl';

function rasterStyle(
  id: string,
  tiles: string[],
  attribution: string,
  maxzoom = 19,
): StyleSpecification {
  return {
    version: 8,
    sources: {
      [id]: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution,
        maxzoom,
      },
    },
    layers: [
      {
        id,
        type: 'raster',
        source: id,
      },
    ],
  };
}

export const OSM_MAP_STYLE = rasterStyle(
  'osm',
  ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
);

export const DEFAULT_MAP_VIEW = {
  longitude: 37.6173,
  latitude: 55.7558,
  zoom: 10,
};
