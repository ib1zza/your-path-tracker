import { describe, expect, it } from 'vitest';
import type { RouteFeature } from '../../types/route';
import { dedupeRoutes, extractTimeFromLabel, getRouteDedupKeys } from './routeDate';

function route(partial: {
  id: string;
  name: string;
  createdAt?: string;
  distanceMeters?: number;
  coordinates?: [number, number][];
}): RouteFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: partial.coordinates ?? [
        [37.6, 55.75],
        [37.61, 55.76],
      ],
    },
    properties: {
      id: partial.id,
      name: partial.name,
      createdAt: partial.createdAt ?? '2026-09-04T10:00:00.000Z',
      updatedAt: partial.createdAt ?? '2026-09-04T10:00:00.000Z',
      color: '#e53935',
      distanceMeters: partial.distanceMeters ?? 1200,
    },
  };
}

describe('extractTimeFromLabel', () => {
  it('parses Apple Health 12-hour names', () => {
    const iso = extractTimeFromLabel('route_2024-03-15_7-32am');
    expect(iso).toBeDefined();
    expect(iso?.startsWith('2024-03-15')).toBe(true);
  });

  it('parses 24-hour underscore names', () => {
    const iso = extractTimeFromLabel('route_2024-07-17_22-20-00');
    expect(iso).toBeDefined();
    expect(iso?.startsWith('2024-07-17')).toBe(true);
  });
});

describe('dedupeRoutes', () => {
  it('keeps one route when Health names share a start minute', () => {
    const first = route({ id: 'a', name: 'route_2024-03-15_7-32am', distanceMeters: 1500 });
    const second = route({ id: 'b', name: 'route_2024-03-15_7-32am', distanceMeters: 1510 });
    const result = dedupeRoutes([first, second]);
    expect(result.routes).toHaveLength(1);
    expect(result.removedIds).toEqual(['b']);
  });

  it('keeps different times as separate routes', () => {
    const morning = route({ id: 'a', name: 'route_2024-03-15_7-32am' });
    const evening = route({
      id: 'b',
      name: 'route_2024-03-15_7-40pm',
      coordinates: [
        [37.62, 55.77],
        [37.63, 55.78],
      ],
    });
    const result = dedupeRoutes([morning, evening]);
    expect(result.routes).toHaveLength(2);
    expect(result.removedIds).toEqual([]);
  });

  it('matches by name and distance when there is no clock', () => {
    const first = route({ id: 'a', name: 'Park loop', distanceMeters: 1010 });
    const second = route({ id: 'b', name: 'Park loop', distanceMeters: 1090 });
    expect(getRouteDedupKeys(first).some((key) => key.startsWith('n:'))).toBe(true);
    const result = dedupeRoutes([first, second]);
    expect(result.removedIds).toEqual(['b']);
  });
});
