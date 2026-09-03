import { routesToHeatmapPoints } from './heatmap';
import { routesGeometryKey } from './routeGeometry';
import { formatDistance, type RouteFeature } from '../../types/route';

export interface RouteStats {
  routeCount: number;
  totalDistanceMeters: number;
  totalDistanceLabel: string;
  uniqueCells: number;
  revisitedCells: number;
  maxVisits: number;
  hottestShare: number;
}

let cachedKey = '';
let cachedStats: RouteStats | null = null;

export function computeRouteStats(routes: RouteFeature[]): RouteStats {
  const key = `${routes.length}:${routesGeometryKey(routes)}:${routes.reduce(
    (sum, route) => sum + (route.properties.distanceMeters || 0),
    0,
  )}`;
  if (cachedStats && cachedKey === key) {
    return cachedStats;
  }

  const totalDistanceMeters = routes.reduce(
    (sum, route) => sum + (route.properties.distanceMeters || 0),
    0,
  );
  const heatmap = routesToHeatmapPoints(routes);
  const visits = heatmap.features.map((feature) => Number(feature.properties?.visits ?? 1));
  const uniqueCells = visits.length;
  const revisitedCells = visits.filter((value) => value >= 2).length;
  const maxVisits = visits.reduce((max, value) => Math.max(max, value), 0);
  const hottestShare = uniqueCells === 0 ? 0 : revisitedCells / uniqueCells;

  cachedStats = {
    routeCount: routes.length,
    totalDistanceMeters,
    totalDistanceLabel: formatDistance(totalDistanceMeters),
    uniqueCells,
    revisitedCells,
    maxVisits,
    hottestShare,
  };
  cachedKey = key;
  return cachedStats;
}
