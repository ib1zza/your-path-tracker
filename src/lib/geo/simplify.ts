import { lineString, simplify } from '@turf/turf';
import type { Position } from 'geojson';

export function simplifyLine(
  coordinates: Position[],
  tolerance = 0.00005,
): Position[] {
  if (coordinates.length < 3) {
    return coordinates;
  }

  const feature = lineString(coordinates);
  const simplified = simplify(feature, { tolerance, highQuality: true });
  return simplified.geometry.coordinates;
}
