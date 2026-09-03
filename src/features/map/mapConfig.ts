import type { StyleSpecification } from 'maplibre-gl';

export type MapStyleId = 'osm' | 'dark' | 'topo';

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

export const MAP_STYLES: Record<
  MapStyleId,
  { label: string; style: StyleSpecification }
> = {
  osm: {
    label: 'Streets',
    style: rasterStyle(
      'osm',
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    ),
  },
  dark: {
    label: 'Dark',
    style: rasterStyle(
      'dark',
      ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    ),
  },
  topo: {
    label: 'Topo',
    style: rasterStyle(
      'topo',
      ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      17,
    ),
  },
};

export const DEFAULT_MAP_VIEW = {
  longitude: 37.6173,
  latitude: 55.7558,
  zoom: 10,
};

/** @deprecated use MAP_STYLES.osm.style */
export const OSM_MAP_STYLE = MAP_STYLES.osm.style;
