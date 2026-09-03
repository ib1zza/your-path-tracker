import type { Position } from 'geojson';

function haversineMeters(a: Position, b: Position): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Removes classic GPS spike points: a vertex that jumps far away and
 * then comes back near the previous track.
 */
export function removeSpikePoints(
  points: Position[],
  options?: { minJumpMeters?: number; spikeFactor?: number },
): { points: Position[]; removed: number } {
  if (points.length < 3) {
    return { points, removed: 0 };
  }

  const minJumpMeters = options?.minJumpMeters ?? 80;
  const spikeFactor = options?.spikeFactor ?? 6;

  const stepDistances: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    stepDistances.push(haversineMeters(points[i - 1], points[i]));
  }
  const typical = Math.max(15, median(stepDistances));
  const jumpThreshold = Math.max(minJumpMeters, typical * spikeFactor);

  const keep = points.map(() => true);

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dPrev = haversineMeters(prev, curr);
    const dNext = haversineMeters(curr, next);
    const dSkip = haversineMeters(prev, next);

    const isSpike =
      dPrev >= jumpThreshold &&
      dNext >= jumpThreshold &&
      dSkip < Math.min(dPrev, dNext) * 0.55;

    if (isSpike) {
      keep[i] = false;
    }
  }

  // Also drop isolated far endpoints that jump from the next/prev point.
  if (points.length >= 2) {
    const firstJump = haversineMeters(points[0], points[1]);
    if (firstJump >= jumpThreshold * 1.5) {
      keep[0] = false;
    }
    const lastJump = haversineMeters(points[points.length - 2], points[points.length - 1]);
    if (lastJump >= jumpThreshold * 1.5) {
      keep[points.length - 1] = false;
    }
  }

  const cleaned = points.filter((_, index) => keep[index]);
  if (cleaned.length < 2) {
    return { points, removed: 0 };
  }

  return { points: cleaned, removed: points.length - cleaned.length };
}
