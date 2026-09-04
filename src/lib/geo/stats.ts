import { routesToHeatmapPoints } from './heatmap';
import { getRouteActivityDate } from './routeDate';
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

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function routesInCalendarMonth(routes: RouteFeature[], month: Date): RouteFeature[] {
  const key = monthKey(month);
  return routes.filter((route) => monthKey(getRouteActivityDate(route)) === key);
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export interface PeriodComparison {
  currentLabel: string;
  previousLabel: string;
  current: RouteStats;
  previous: RouteStats;
  distanceDeltaMeters: number;
  countDelta: number;
}

export function compareAdjacentMonths(routes: RouteFeature[], now = new Date()): PeriodComparison {
  const previousMonth = shiftMonth(now, -1);
  const current = computeRouteStats(routesInCalendarMonth(routes, now));
  const previous = computeRouteStats(routesInCalendarMonth(routes, previousMonth));
  return {
    currentLabel: formatMonthLabel(now),
    previousLabel: formatMonthLabel(previousMonth),
    current,
    previous,
    distanceDeltaMeters: current.totalDistanceMeters - previous.totalDistanceMeters,
    countDelta: current.routeCount - previous.routeCount,
  };
}
