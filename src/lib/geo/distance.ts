import { length, lineString } from '@turf/turf';
import type { LineString } from 'geojson';

export function calculateDistanceMeters(geometry: LineString): number {
  if (geometry.coordinates.length < 2) {
    return 0;
  }
  return length(lineString(geometry.coordinates), { units: 'meters' });
}
