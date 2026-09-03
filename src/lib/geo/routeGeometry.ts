import { calculateDistanceMeters } from './distance';
import { simplifyLine } from './simplify';
import type { RouteFeature } from '../../types/route';

const MAX_POINTS_BEFORE_SIMPLIFY = 400;
const DISPLAY_TOLERANCE = 0.00008;

/** Stable key for geometry-only changes (ignores name/placeName/notes). */
export function routesGeometryKey(routes: RouteFeature[]): string {
  return routes
    .map((route) => {
      const coords = route.geometry.coordinates;
      const first = coords[0];
      const last = coords[coords.length - 1];
      return `${route.properties.id}:${coords.length}:${first?.[0]},${first?.[1]}:${last?.[0]},${last?.[1]}`;
    })
    .join('|');
}

/** Thin dense GPS/GPX tracks so MapLibre/Turf stay responsive. */
export function thinRouteGeometry(route: RouteFeature): RouteFeature {
  const coords = route.geometry.coordinates;
  if (coords.length <= MAX_POINTS_BEFORE_SIMPLIFY) {
    return route;
  }

  const simplified = simplifyLine(coords, DISPLAY_TOLERANCE);
  if (simplified.length >= coords.length) {
    return route;
  }

  const geometry = {
    type: 'LineString' as const,
    coordinates: simplified,
  };

  return {
    ...route,
    properties: {
      ...route.properties,
      distanceMeters: calculateDistanceMeters(geometry),
      updatedAt: new Date().toISOString(),
    },
    geometry,
  };
}

export function thinRoutes(routes: RouteFeature[]): {
  routes: RouteFeature[];
  changed: RouteFeature[];
} {
  const changed: RouteFeature[] = [];
  const next = routes.map((route) => {
    const thinned = thinRouteGeometry(route);
    if (thinned !== route) {
      changed.push(thinned);
    }
    return thinned;
  });
  return { routes: next, changed };
}
