import { useMemo } from 'react';
import { compareAdjacentMonths, computeRouteStats } from '../../lib/geo/stats';
import { routesGeometryKey } from '../../lib/geo/routeGeometry';
import { formatDistance } from '../../types/route';
import type { RouteFeature } from '../../types/route';

interface StatsPanelProps {
  routes: RouteFeature[];
  allRoutes: RouteFeature[];
  filtered: boolean;
}

export function StatsPanel({ routes, allRoutes, filtered }: StatsPanelProps) {
  const geometryKey = useMemo(() => routesGeometryKey(routes), [routes]);
  const totalDistance = useMemo(
    () => routes.reduce((sum, route) => sum + (route.properties.distanceMeters || 0), 0),
    [routes],
  );
  const stats = useMemo(
    () => computeRouteStats(routes),
    // geometryKey + distance cover geometry/stats changes; placeName updates are ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geometryKey, routes.length, totalDistance],
  );
  const comparison = useMemo(() => compareAdjacentMonths(allRoutes), [allRoutes]);

  if (allRoutes.length === 0) {
    return null;
  }

  const averageMeters = stats.routeCount > 0 ? stats.totalDistanceMeters / stats.routeCount : 0;
  const distanceDeltaLabel =
    comparison.distanceDeltaMeters === 0
      ? 'same as last month'
      : `${comparison.distanceDeltaMeters > 0 ? '+' : '−'}${formatDistance(
          Math.abs(comparison.distanceDeltaMeters),
        )} vs last month`;

  return (
    <div className="stats-panel">
      <div className="stats-panel__item">
        <strong>{stats.routeCount}</strong>
        <span>{filtered ? 'shown' : 'routes'}</span>
      </div>
      <div className="stats-panel__item">
        <strong>{stats.totalDistanceLabel}</strong>
        <span>{filtered ? 'filtered' : 'total'}</span>
      </div>
      {filtered && (
        <div className="stats-panel__item">
          <strong>{formatDistance(averageMeters)}</strong>
          <span>avg</span>
        </div>
      )}
      <div className="stats-panel__item">
        <strong>{stats.revisitedCells}</strong>
        <span>hot cells</span>
      </div>
      <div className="stats-panel__item">
        <strong>{stats.maxVisits || 1}×</strong>
        <span>max visits</span>
      </div>
      <div className="stats-panel__compare" title={distanceDeltaLabel}>
        <span>
          {comparison.currentLabel}: {comparison.current.totalDistanceLabel} ·{' '}
          {comparison.current.routeCount}
        </span>
        <small>
          {comparison.countDelta === 0
            ? 'same count'
            : `${comparison.countDelta > 0 ? '+' : ''}${comparison.countDelta} routes`}{' '}
          · {distanceDeltaLabel}
        </small>
      </div>
    </div>
  );
}
