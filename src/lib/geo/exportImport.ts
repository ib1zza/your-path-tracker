import { gpx } from '@tmcw/togeojson';
import { v4 as uuidv4 } from 'uuid';
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString } from 'geojson';
import { calculateDistanceMeters } from './distance';
import { pickRouteColor, type RouteCollection, type RouteFeature } from '../../types/route';

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/geo+json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportAllRoutes(routes: RouteFeature[]): void {
  const collection: RouteCollection = {
    type: 'FeatureCollection',
    features: routes,
  };
  downloadJson(collection, `path-tracker-routes-${Date.now()}.geojson`);
}

export function exportRoute(route: RouteFeature): void {
  const collection: RouteCollection = {
    type: 'FeatureCollection',
    features: [route],
  };
  const safeName = route.properties.name.replace(/[^\w\-]+/g, '-').toLowerCase();
  downloadJson(collection, `${safeName || 'route'}.geojson`);
}

function isLooseRouteFeature(value: unknown): value is Feature<LineString | MultiLineString> {
  if (!value || typeof value !== 'object') return false;
  const feature = value as Feature;
  return (
    feature.type === 'Feature' &&
    (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString') &&
    Array.isArray((feature.geometry as LineString | MultiLineString).coordinates)
  );
}

function toLineStrings(geometry: LineString | MultiLineString): LineString[] {
  if (geometry.type === 'LineString') {
    return [geometry];
  }
  return geometry.coordinates
    .filter((coords) => coords.length >= 2)
    .map((coordinates) => ({ type: 'LineString' as const, coordinates }));
}

function normalizeImportedFeature(
  feature: Feature<LineString | MultiLineString>,
  index: number,
  existingCount: number,
): RouteFeature[] {
  const now = new Date().toISOString();
  const baseName =
    (typeof feature.properties?.name === 'string' && feature.properties.name) ||
    `Imported ${index + 1}`;
  const baseId =
    typeof feature.properties?.id === 'string' && feature.properties.id
      ? feature.properties.id
      : uuidv4();
  const notes =
    typeof feature.properties?.notes === 'string'
      ? feature.properties.notes
      : typeof feature.properties?.desc === 'string'
        ? feature.properties.desc
        : undefined;
  const color =
    typeof feature.properties?.color === 'string'
      ? feature.properties.color
      : pickRouteColor(existingCount + index);

  return toLineStrings(feature.geometry).map((geometry, partIndex) => {
    const id = partIndex === 0 ? baseId : `${baseId}-${partIndex + 1}`;
    const name = partIndex === 0 ? baseName : `${baseName} (${partIndex + 1})`;
    return {
      type: 'Feature',
      properties: {
        id,
        name,
        createdAt:
          typeof feature.properties?.createdAt === 'string'
            ? feature.properties.createdAt
            : now,
        updatedAt: now,
        color,
        notes,
        placeName:
          typeof feature.properties?.placeName === 'string'
            ? feature.properties.placeName
            : undefined,
        source: 'import' as const,
        distanceMeters: calculateDistanceMeters(geometry),
      },
      geometry,
    };
  });
}

export function parseRouteCollection(text: string, existingCount = 0): RouteFeature[] {
  const parsed = JSON.parse(text) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid GeoJSON file');
  }

  const data = parsed as FeatureCollection | Feature;

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    const routes = data.features
      .filter(isLooseRouteFeature)
      .flatMap((feature, index) => normalizeImportedFeature(feature, index, existingCount));
    if (routes.length === 0) {
      throw new Error('No valid LineString routes found in file');
    }
    return routes;
  }

  if (data.type === 'Feature' && isLooseRouteFeature(data)) {
    return normalizeImportedFeature(data, 0, existingCount);
  }

  throw new Error('Expected GeoJSON Feature or FeatureCollection');
}

export function parseGpxText(text: string, existingCount = 0): RouteFeature[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX file');
  }

  const converted = gpx(doc) as FeatureCollection<Geometry>;
  const lineFeatures = converted.features.filter(isLooseRouteFeature);

  if (lineFeatures.length === 0) {
    throw new Error('No tracks or routes found in GPX');
  }

  return lineFeatures.flatMap((feature, index) =>
    normalizeImportedFeature(feature, index, existingCount),
  );
}

export async function readRouteFile(file: File, existingCount = 0): Promise<RouteFeature[]> {
  const text = await file.text();
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.gpx') || file.type.includes('gpx')) {
    return parseGpxText(text, existingCount);
  }

  return parseRouteCollection(text, existingCount);
}

/** @deprecated use readRouteFile */
export function readGeoJsonFile(file: File): Promise<RouteFeature[]> {
  return readRouteFile(file);
}
