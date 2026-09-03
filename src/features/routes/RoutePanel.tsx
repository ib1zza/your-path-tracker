import { useRef, useState } from 'react';
import { exportAllRoutes, exportRoute, type ImportKind } from '../../lib/geo/exportImport';
import { useDrawStore } from '../../stores/drawStore';
import { useRouteStore } from '../../stores/routeStore';
import { RouteItem } from './RouteItem';
import { StatsPanel } from './StatsPanel';

const IMPORT_OPTIONS: Array<{
  kind: ImportKind;
  label: string;
  hint: string;
  accept: string;
  multiple: boolean;
}> = [
  {
    kind: 'auto',
    label: 'Auto-detect',
    hint: 'GPX, GeoJSON, KML, TCX or ZIP',
    accept: '.geojson,.json,.gpx,.kml,.kmz,.tcx,.zip,application/geo+json,application/gpx+xml,application/zip',
    multiple: true,
  },
  {
    kind: 'gpx',
    label: 'GPX',
    hint: 'One or more .gpx files',
    accept: '.gpx,application/gpx+xml',
    multiple: true,
  },
  {
    kind: 'geojson',
    label: 'GeoJSON',
    hint: '.geojson or .json',
    accept: '.geojson,.json,application/geo+json',
    multiple: true,
  },
  {
    kind: 'health',
    label: 'Apple Health',
    hint: 'export.zip → workout-routes',
    accept: '.zip,application/zip',
    multiple: false,
  },
  {
    kind: 'kml',
    label: 'KML / KMZ',
    hint: 'Google Earth export',
    accept: '.kml,.kmz',
    multiple: true,
  },
  {
    kind: 'tcx',
    label: 'TCX',
    hint: 'Garmin activity',
    accept: '.tcx',
    multiple: true,
  },
];

export function RoutePanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingKindRef = useRef<ImportKind>('auto');
  const [importOpen, setImportOpen] = useState(false);
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

  const openFilePicker = (option: (typeof IMPORT_OPTIONS)[number]) => {
    pendingKindRef.current = option.kind;
    setImportOpen(false);
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = option.accept;
    input.multiple = option.multiple;
    input.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (files.length === 0) return;

    const overwrite = window.confirm(
      'If imported routes have the same IDs as existing ones, overwrite them?',
    );

    try {
      const result = await importRoutes(files, overwrite, pendingKindRef.current);
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
        <div className="import-menu">
          <button
            type="button"
            className="btn btn--ghost"
            aria-expanded={importOpen}
            aria-haspopup="menu"
            onClick={() => setImportOpen((open) => !open)}
          >
            Import
          </button>
          {importOpen && (
            <>
              <button
                type="button"
                className="import-menu__backdrop"
                aria-label="Close import menu"
                onClick={() => setImportOpen(false)}
              />
              <div className="import-menu__list" role="menu">
                {IMPORT_OPTIONS.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    className="import-menu__item"
                    role="menuitem"
                    onClick={() => openFilePicker(option)}
                  >
                    <span>{option.label}</span>
                    <small>{option.hint}</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
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
          accept=".geojson,.json,.gpx,.kml,.kmz,.tcx,.zip,application/geo+json,application/gpx+xml,application/zip"
          hidden
          onChange={(event) => void handleImportFile(event)}
        />
      </div>

      {importMessage && <p className="route-panel__message">{importMessage}</p>}

      <div className="route-panel__list">
        {isLoading && <p className="route-panel__empty">Loading routes…</p>}
        {!isLoading && routes.length === 0 && (
          <p className="route-panel__empty">
            No routes yet. Draw, record GPS, or import GPX / Apple Health ZIP.
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
