import { gpx, kml } from '@tmcw/togeojson';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString } from 'geojson';
import { calculateDistanceMeters } from './distance';
import { extractImportedCreatedAt } from './routeDate';
import { simplifyLine } from './simplify';
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

  return toLineStrings(feature.geometry).map((rawGeometry, partIndex) => {
    const id = partIndex === 0 ? baseId : `${baseId}-${partIndex + 1}`;
    const name = partIndex === 0 ? baseName : `${baseName} (${partIndex + 1})`;
    const coordinates = simplifyLine(rawGeometry.coordinates, 0.00008);
    const geometry = {
      type: 'LineString' as const,
      coordinates: coordinates.length >= 2 ? coordinates : rawGeometry.coordinates,
    };
    const createdAt =
      extractImportedCreatedAt(
        feature.properties as Record<string, unknown> | null | undefined,
        baseName,
      ) ?? now;
    return {
      type: 'Feature',
      properties: {
        id,
        name,
        createdAt,
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

export function parseGpxText(
  text: string,
  existingCount = 0,
  fallbackName?: string,
): RouteFeature[] {
  const doc = parseXml(text, 'Invalid GPX file');
  const converted = gpx(doc) as FeatureCollection<Geometry>;
  const lineFeatures = converted.features.filter(isLooseRouteFeature);

  if (lineFeatures.length === 0) {
    throw new Error('No tracks or routes found in GPX');
  }

  return lineFeatures.flatMap((feature, index) => {
    if (
      fallbackName &&
      !(typeof feature.properties?.name === 'string' && feature.properties.name.trim())
    ) {
      feature = {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          name: fallbackName.replace(/\.[^.]+$/, '').split('/').pop() || fallbackName,
        },
      };
    }
    return normalizeImportedFeature(feature, index, existingCount);
  });
}

function parseXml(text: string, errorMessage: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error(errorMessage);
  }
  return doc;
}

export function parseKmlText(text: string, existingCount = 0): RouteFeature[] {
  const doc = parseXml(text, 'Invalid KML file');
  const converted = kml(doc) as FeatureCollection<Geometry>;
  const lineFeatures = converted.features.filter(isLooseRouteFeature);

  if (lineFeatures.length === 0) {
    throw new Error('No lines found in KML');
  }

  return lineFeatures.flatMap((feature, index) =>
    normalizeImportedFeature(feature, index, existingCount),
  );
}

export function parseTcxText(text: string, existingCount = 0): RouteFeature[] {
  const doc = parseXml(text, 'Invalid TCX file');
  const activities = [...doc.getElementsByTagName('Activity')];
  const tracks = activities.length > 0 ? activities : [...doc.getElementsByTagName('Course')];
  const now = new Date().toISOString();
  const routes: RouteFeature[] = [];

  const sources = tracks.length > 0 ? tracks : [doc.documentElement];

  sources.forEach((source, index) => {
    const points = [...source.getElementsByTagName('Trackpoint')];
    const rawCoordinates: [number, number][] = [];

    for (const point of points) {
      const lat = Number(point.getElementsByTagName('LatitudeDegrees')[0]?.textContent);
      const lng = Number(point.getElementsByTagName('LongitudeDegrees')[0]?.textContent);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        rawCoordinates.push([lng, lat]);
      }
    }

    if (rawCoordinates.length < 2) {
      return;
    }

    const simplified = simplifyLine(rawCoordinates, 0.00008);
    const coordinates =
      simplified.length >= 2
        ? (simplified as [number, number][])
        : rawCoordinates;
    const name =
      source.getElementsByTagName('Name')[0]?.textContent?.trim() ||
      source.getAttribute('Sport') ||
      `TCX ${index + 1}`;
    const geometry = { type: 'LineString' as const, coordinates };
    routes.push({
      type: 'Feature',
      properties: {
        id: uuidv4(),
        name,
        createdAt: now,
        updatedAt: now,
        color: pickRouteColor(existingCount + routes.length),
        source: 'import',
        distanceMeters: calculateDistanceMeters(geometry),
      },
      geometry,
    });
  });

  if (routes.length === 0) {
    throw new Error('No GPS trackpoints found in TCX');
  }

  return routes;
}

async function parseZipRoutes(
  file: File,
  existingCount = 0,
  kind: ImportKind = 'auto',
): Promise<RouteFeature[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const routes: RouteFeature[] = [];
  const errors: string[] = [];

  const gpxFiles = entries.filter((entry) => entry.name.toLowerCase().endsWith('.gpx'));
  const kmlFiles = entries.filter((entry) => entry.name.toLowerCase().endsWith('.kml'));
  const tcxFiles = entries.filter((entry) => entry.name.toLowerCase().endsWith('.tcx'));
  const geojsonFiles = entries.filter((entry) =>
    /\.(geojson|json)$/i.test(entry.name),
  );

  const healthRoutes = gpxFiles.filter((entry) =>
    /workout-routes/i.test(entry.name),
  );
  const preferredGpx =
    kind === 'health' || (kind === 'auto' && healthRoutes.length > 0)
      ? healthRoutes.length > 0
        ? healthRoutes
        : gpxFiles
      : gpxFiles;

  const includeGpx = kind === 'auto' || kind === 'health' || kind === 'gpx';
  const includeKml = kind === 'auto' || kind === 'kml';
  const includeTcx = kind === 'auto' || kind === 'tcx';
  const includeGeojson = kind === 'auto' || kind === 'geojson';

  const queued = [
    ...(includeGpx ? preferredGpx : []),
    ...(includeKml ? kmlFiles : []),
    ...(includeTcx ? tcxFiles : []),
    ...(includeGeojson ? geojsonFiles : []),
  ];
  if (queued.length === 0) {
    throw new Error(
      kind === 'health'
        ? 'No workout-routes GPX files found in this Apple Health export'
        : 'No GPX, KML, TCX or GeoJSON files found in the archive',
    );
  }

  for (const entry of queued) {
    try {
      const text = await entry.async('text');
      const lower = entry.name.toLowerCase();
      const offset = existingCount + routes.length;
      if (lower.endsWith('.gpx')) {
        routes.push(...parseGpxText(text, offset, entry.name));
      } else if (lower.endsWith('.kml')) {
        routes.push(...parseKmlText(text, offset));
      } else if (lower.endsWith('.tcx')) {
        routes.push(...parseTcxText(text, offset));
      } else {
        routes.push(...parseRouteCollection(text, offset));
      }
    } catch (error) {
      errors.push(`${entry.name}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  if (routes.length === 0) {
    throw new Error(errors[0] || 'No valid routes found in the archive');
  }

  return routes;
}

export type ImportKind = 'auto' | 'gpx' | 'geojson' | 'health' | 'kml' | 'tcx';

export async function readRouteFile(
  file: File,
  existingCount = 0,
  kind: ImportKind = 'auto',
): Promise<RouteFeature[]> {
  const lower = file.name.toLowerCase();
  const resolved: ImportKind =
    kind !== 'auto'
      ? kind
      : lower.endsWith('.gpx') || file.type.includes('gpx')
        ? 'gpx'
        : lower.endsWith('.kml') || lower.endsWith('.kmz')
          ? 'kml'
          : lower.endsWith('.tcx')
            ? 'tcx'
            : lower.endsWith('.zip')
              ? 'health'
              : 'geojson';

  if (lower.endsWith('.zip') || lower.endsWith('.kmz') || file.type.includes('zip')) {
    return parseZipRoutes(file, existingCount, resolved);
  }

  const text = await file.text();

  if (resolved === 'gpx') {
    return parseGpxText(text, existingCount);
  }
  if (resolved === 'kml') {
    return parseKmlText(text, existingCount);
  }
  if (resolved === 'tcx') {
    return parseTcxText(text, existingCount);
  }

  return parseRouteCollection(text, existingCount);
}

export async function readRouteFiles(
  files: File[],
  existingCount = 0,
  kind: ImportKind = 'auto',
): Promise<RouteFeature[]> {
  const routes: RouteFeature[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      routes.push(...(await readRouteFile(file, existingCount + routes.length, kind)));
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  if (routes.length === 0) {
    throw new Error(errors[0] || 'No valid routes found');
  }

  return routes;
}
