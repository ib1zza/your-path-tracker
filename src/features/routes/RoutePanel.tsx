import { useRef, useState } from 'react';
import { exportAllRoutes, exportRoute } from '../../lib/geo/exportImport';
import { useDrawStore } from '../../stores/drawStore';
import { useRouteStore } from '../../stores/routeStore';
import { RouteItem } from './RouteItem';
import { StatsPanel } from './StatsPanel';

export function RoutePanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const routes = useRouteStore((state) => state.routes);
  const selectedId = useRouteStore((state) => state.selectedId);
  const isLoading = useRouteStore((state) => state.isLoading);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const updateRoute = useRouteStore((state) => state.updateRoute);
  const deleteRoute = useRouteStore((state) => state.deleteRoute);
  const toggleVisibility = useRouteStore((state) => state.toggleVisibility);
  const isVisible = useRouteStore((state) => state.isVisible);
  const importRoutes = useRouteStore((state) => state.importRoutes);
  const startEdit = useDrawStore((state) => state.startEdit);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const overwrite = window.confirm(
      'If imported routes have the same IDs as existing ones, overwrite them?',
    );

    try {
      const result = await importRoutes(file, overwrite);
      setImportMessage(`Imported ${result.imported}, skipped ${result.skipped}`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Import failed');
    }
  };

  return (
    <aside className="route-panel">
      <div className="route-panel__header">
        <h2>Routes</h2>
        <span className="route-panel__count">{routes.length}</span>
      </div>

      <StatsPanel />

      <div className="route-panel__toolbar">
        <button type="button" className="btn btn--ghost" onClick={handleImportClick}>
          Import
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={routes.length === 0}
          onClick={() => exportAllRoutes(routes)}
        >
          Export all
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json,.gpx,application/geo+json,application/gpx+xml"
          hidden
          onChange={(event) => void handleImportFile(event)}
        />
      </div>

      {importMessage && <p className="route-panel__message">{importMessage}</p>}

      <div className="route-panel__list">
        {isLoading && <p className="route-panel__empty">Loading routes…</p>}
        {!isLoading && routes.length === 0 && (
          <p className="route-panel__empty">
            No routes yet. Draw, record GPS, or import GeoJSON/GPX.
          </p>
        )}
        {routes.map((route) => (
          <RouteItem
            key={route.properties.id}
            route={route}
            isSelected={selectedId === route.properties.id}
            isVisible={isVisible(route.properties.id)}
            onSelect={() => selectRoute(route.properties.id)}
            onToggleVisibility={() => toggleVisibility(route.properties.id)}
            onDelete={() => {
              if (window.confirm(`Delete "${route.properties.name}"?`)) {
                void deleteRoute(route.properties.id);
              }
            }}
            onRename={(name) =>
              void updateRoute({
                ...route,
                properties: {
                  ...route.properties,
                  name,
                  updatedAt: new Date().toISOString(),
                },
              })
            }
            onNotesChange={(notes) =>
              void updateRoute({
                ...route,
                properties: {
                  ...route.properties,
                  notes: notes || undefined,
                  updatedAt: new Date().toISOString(),
                },
              })
            }
            onEditGeometry={() => {
              selectRoute(route.properties.id);
              startEdit(route.properties.id, route.geometry.coordinates);
            }}
            onExport={() => exportRoute(route)}
          />
        ))}
      </div>
    </aside>
  );
}
