import { useMemo } from 'react';
import { computeRouteStats } from '../../lib/geo/stats';
import { useRouteStore } from '../../stores/routeStore';

export function StatsPanel() {
  const routes = useRouteStore((state) => state.routes);
  const stats = useMemo(() => computeRouteStats(routes), [routes]);

  if (routes.length === 0) {
    return null;
  }

  return (
    <div className="stats-panel">
      <div className="stats-panel__item">
        <strong>{stats.routeCount}</strong>
        <span>routes</span>
      </div>
      <div className="stats-panel__item">
        <strong>{stats.totalDistanceLabel}</strong>
        <span>total</span>
      </div>
      <div className="stats-panel__item">
        <strong>{stats.revisitedCells}</strong>
        <span>hot cells</span>
      </div>
      <div className="stats-panel__item">
        <strong>{stats.maxVisits || 1}×</strong>
        <span>max visits</span>
      </div>
    </div>
  );
}
