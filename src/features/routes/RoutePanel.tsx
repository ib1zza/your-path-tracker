import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exportAllRoutes,
  exportRoute,
  readRouteFiles,
  type ImportKind,
} from '../../lib/geo/exportImport';
import {
  filterRoutesByDateRange,
  groupKeyForRoute,
  groupRoutes,
  type RouteGroupBy,
} from '../../lib/geo/routeDate';
import { useDrawStore } from '../../stores/drawStore';
import { useMapUiStore } from '../../stores/mapUiStore';
import { useRouteStore } from '../../stores/routeStore';
import type { RouteFeature } from '../../types/route';
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
    accept:
      '.geojson,.json,.gpx,.kml,.kmz,.tcx,.zip,application/geo+json,application/gpx+xml,application/zip',
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

const GROUP_OPTIONS: Array<{ value: RouteGroupBy; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'none', label: 'Flat' },
];

export function RoutePanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingKindRef = useRef<ImportKind>('auto');
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<RouteGroupBy>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const requestFitAllRoutes = useMapUiStore((state) => state.requestFitAllRoutes);

  const routes = useRouteStore((state) => state.routes);
  const selectedId = useRouteStore((state) => state.selectedId);
  const isLoading = useRouteStore((state) => state.isLoading);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const updateRoute = useRouteStore((state) => state.updateRoute);
  const deleteRoute = useRouteStore((state) => state.deleteRoute);
  const toggleVisibility = useRouteStore((state) => state.toggleVisibility);
  const isVisible = useRouteStore((state) => state.isVisible);
  const applyImportedRoutes = useRouteStore((state) => state.applyImportedRoutes);
  const startEdit = useDrawStore((state) => state.startEdit);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const searchedRoutes = useMemo(() => {
    if (!debouncedSearch) {
      return routes;
    }

    return routes.filter((route) => {
      const name = route.properties.name.toLowerCase();
      const place = route.properties.placeName?.toLowerCase() ?? '';
      return name.includes(debouncedSearch) || place.includes(debouncedSearch);
    });
  }, [debouncedSearch, routes]);

  const filteredRoutes = useMemo(
    () => filterRoutesByDateRange(searchedRoutes, dateFrom || null, dateTo || null),
    [dateFrom, dateTo, searchedRoutes],
  );

  const groups = useMemo(() => groupRoutes(filteredRoutes, groupBy), [filteredRoutes, groupBy]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = routes.find((route) => route.properties.id === selectedId);
    if (!selected) return;

    const key = groupKeyForRoute(selected, groupBy);
    setCollapsed((prev) => (prev[key] ? { ...prev, [key]: false } : prev));

    window.requestAnimationFrame(() => {
      const node = listRef.current?.querySelector(`[data-route-id="${selectedId}"]`);
      node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [groupBy, routes, selectedId]);

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

    const importKind = pendingKindRef.current;

    try {
      const parsed = await readRouteFiles(files, routes.length, importKind);
      const overwrite = window.confirm(
        parsed.appleHealth
          ? 'Match routes by start date/time (and similar geometry). Replace matches? Cancel = skip duplicates and keep your edits.'
          : 'Match by id, start time, or similar path. Replace matches? Cancel = skip duplicates.',
      );
      const result = await applyImportedRoutes(parsed, overwrite);
      setImportMessage(`Imported ${result.imported}, skipped ${result.skipped}`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Import failed');
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const visibleRouteCount = routes.filter((route) => isVisible(route.properties.id)).length;

  const renderRouteItem = (route: RouteFeature) => (
    <div key={route.properties.id} data-route-id={route.properties.id}>
      <RouteItem
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
        onColorChange={(color) =>
          void updateRoute({
            ...route,
            properties: {
              ...route.properties,
              color,
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
    </div>
  );

  return (
    <aside className="route-panel">
      <div className="route-panel__header">
        <h2>Routes</h2>
        <span className="route-panel__count">
          {filteredRoutes.length === routes.length
            ? routes.length
            : `${filteredRoutes.length}/${routes.length}`}
        </span>
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
          disabled={visibleRouteCount === 0}
          onClick={requestFitAllRoutes}
        >
          Show all
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
          accept=".geojson,.json,.gpx,.kml,.kmz,.tcx,.zip,application/geo+json,application/gpx+xml,application/zip"
          hidden
          onChange={(event) => void handleImportFile(event)}
        />
      </div>

      {routes.length > 0 && (
        <div className="route-panel__search">
          <input
            type="search"
            className="route-panel__search-input"
            placeholder="Search by name or place…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn btn--ghost btn--tiny route-panel__search-clear"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {routes.length > 0 && (
        <div className="route-panel__filters">
          <div className="route-panel__group-toggle" role="group" aria-label="Group routes">
            {GROUP_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`btn btn--ghost btn--tiny ${groupBy === option.value ? 'btn--active' : ''}`}
                onClick={() => setGroupBy(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="route-panel__date-filters">
            <label>
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
            {(dateFrom || dateTo) && (
              <button type="button" className="btn btn--ghost btn--tiny" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {selectedId && !isLoading && (
        <p className="route-panel__message">
          Focus mode: other routes hidden. Click empty map to show all, or press Path to edit
          points.
        </p>
      )}

      {importMessage && <p className="route-panel__message">{importMessage}</p>}

      <div className="route-panel__list" ref={listRef}>
        {isLoading && <p className="route-panel__empty">Loading routes…</p>}
        {!isLoading && routes.length === 0 && (
          <p className="route-panel__empty">
            No routes yet. Draw, record GPS, or import GPX / Apple Health ZIP.
          </p>
        )}
        {!isLoading && routes.length > 0 && filteredRoutes.length === 0 && (
          <p className="route-panel__empty">
            {debouncedSearch ? 'No routes match your search.' : 'No routes in this date range.'}
          </p>
        )}

        {groups.map((group) => {
          const isFlat = groupBy === 'none';
          const isOpen = isFlat || !collapsed[group.key];

          if (isFlat) {
            return <div key={group.key}>{group.routes.map(renderRouteItem)}</div>;
          }

          return (
            <section key={group.key} className="route-group">
              <button
                type="button"
                className="route-group__header"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.key)}
              >
                <span className="route-group__chevron" aria-hidden>
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="route-group__label">{group.label}</span>
                <span className="route-group__count">{group.routes.length}</span>
              </button>
              {isOpen && (
                <div className="route-group__body">{group.routes.map(renderRouteItem)}</div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
