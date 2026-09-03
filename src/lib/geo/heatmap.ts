import { along, length, lineString } from '@turf/turf';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { routesGeometryKey } from './routeGeometry';
import type { RouteFeature } from '../../types/route';

const MAX_POINTS = 25_000;
const BASE_SAMPLE_STEP_METERS = 25;
const CELL_METERS = 22;

let cachedKey = '';
let cachedResult: FeatureCollection<Point> | null = null;

function cellKey(lng: number, lat: number): string {
  const latSize = CELL_METERS / 111_320;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const lngSize = CELL_METERS / (111_320 * cosLat);
  return `${Math.round(lng / lngSize)}:${Math.round(lat / latSize)}`;
}

function sampleStepMeters(routeCount: number): number {
  if (routeCount > 80) return 60;
  if (routeCount > 40) return 40;
  if (routeCount > 20) return 30;
  return BASE_SAMPLE_STEP_METERS;
}

export function routesToHeatmapPoints(routes: RouteFeature[]): FeatureCollection<Point> {
  const key = routesGeometryKey(routes);
  if (cachedResult && cachedKey === key) {
    return cachedResult;
  }

  const cells = new Map<string, { lng: number; lat: number; visits: number; count: number }>();
  const stepMeters = sampleStepMeters(routes.length);

  for (const route of routes) {
    if (route.geometry.coordinates.length < 2) {
      continue;
    }

    const line = lineString(route.geometry.coordinates);
    const total = length(line, { units: 'meters' });
    if (total <= 0) {
      continue;
    }

    const seen = new Set<string>();
    const steps = Math.max(1, Math.ceil(total / stepMeters));

    for (let i = 0; i <= steps; i += 1) {
      const distance = Math.min(total, (i / steps) * total);
      const point = along(line, distance, { units: 'meters' });
      const [lng, lat] = point.geometry.coordinates;
      const keyCell = cellKey(lng, lat);
      if (seen.has(keyCell)) {
        continue;
      }
      seen.add(keyCell);

      const existing = cells.get(keyCell);
      if (existing) {
        existing.visits += 1;
        existing.lng = (existing.lng * existing.count + lng) / (existing.count + 1);
        existing.lat = (existing.lat * existing.count + lat) / (existing.count + 1);
        existing.count += 1;
      } else {
        cells.set(keyCell, { lng, lat, visits: 1, count: 1 });
      }
    }
  }

  const features: Feature<Point>[] = [];
  for (const cell of cells.values()) {
    features.push({
      type: 'Feature',
      properties: { visits: cell.visits },
      geometry: {
        type: 'Point',
        coordinates: [cell.lng, cell.lat],
      },
    });
    if (features.length >= MAX_POINTS) {
      break;
    }
  }

  const result: FeatureCollection<Point> = { type: 'FeatureCollection', features };
  cachedKey = key;
  cachedResult = result;
  return result;
}
