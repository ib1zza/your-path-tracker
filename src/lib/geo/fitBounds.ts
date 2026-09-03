import bbox from '@turf/bbox';
import type { Map } from 'maplibre-gl';
import type { RouteFeature } from '../../types/route';

export function fitMapToRoute(map: Map, route: RouteFeature, padding = 80): void {
  const coordinates = route.geometry.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return;
  }

  const bounds = bbox(route);
  if (bounds.some((value) => !Number.isFinite(value))) {
    return;
  }

  map.fitBounds(
    [bounds[0], bounds[1], bounds[2], bounds[3]],
    {
      padding,
      duration: 800,
      maxZoom: 16,
    },
  );
}
