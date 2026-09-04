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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const requestFitAllRoutes = useMapUiStore((state) => state.requestFitAllRoutes);
  const selectedTags = useMapUiStore((state) => state.filterTags);
  const setFilterTags = useMapUiStore((state) => state.setFilterTags);
  const toggleFilterTag = useMapUiStore((state) => state.toggleFilterTag);
  const dateFrom = useMapUiStore((state) => state.dateFrom);
  const dateTo = useMapUiStore((state) => state.dateTo);
  const setDateFrom = useMapUiStore((state) => state.setDateFrom);
  const setDateTo = useMapUiStore((state) => state.setDateTo);

  const routes = useRouteStore((state) => state.routes);
  const selectedId = useRouteStore((state) => state.selectedId);
  const isLoading = useRouteStore((state) => state.isLoading);
  const selectRoute = useRouteStore((state) => state.selectRoute);
  const updateRoute = useRouteStore((state) => state.updateRoute);
  const deleteRoute = useRouteStore((state) => state.deleteRoute);
  const toggleVisibility = useRouteStore((state) => state.toggleVisibility);
  const isVisible = useRouteStore((state) => state.isVisible);
  const applyImportedRoutes = useRouteStore((state) => state.applyImportedRoutes);
  const duplicateRoute = useRouteStore((state) => state.duplicateRoute);
  const deleteRoutes = useRouteStore((state) => state.deleteRoutes);
  const setVisibilityMany = useRouteStore((state) => state.setVisibilityMany);
  const mergeRoutes = useRouteStore((state) => state.mergeRoutes);
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
      const tags = (route.properties.tags ?? []).join(' ').toLowerCase();
      return (
        name.includes(debouncedSearch) ||
        place.includes(debouncedSearch) ||
        tags.includes(debouncedSearch)
      );
    });
  }, [debouncedSearch, routes]);

  const taggedRoutes = useMemo(() => {
    if (selectedTags.length === 0) {
      return searchedRoutes;
    }

    return searchedRoutes.filter((route) =>
      selectedTags.every((tag) => route.properties.tags?.includes(tag)),
    );
  }, [searchedRoutes, selectedTags]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const route of routes) {
      for (const tag of route.properties.tags ?? []) {
        tags.add(tag);
      }
    }
    return [...tags].sort();
  }, [routes]);

  const filteredRoutes = useMemo(
    () => filterRoutesByDateRange(taggedRoutes, dateFrom || null, dateTo || null),
    [dateFrom, dateTo, taggedRoutes],
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
    setFilterTags([]);
    setSearchQuery('');
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleBulkDelete = () => {
    if (checkedIds.length === 0) {
      return;
    }
    if (
      !window.confirm(
        `Delete ${checkedIds.length} selected route${checkedIds.length === 1 ? '' : 's'}?`,
      )
    ) {
      return;
    }
    void deleteRoutes(checkedIds);
    setCheckedIds([]);
  };

  const visibleRouteCount = routes.filter((route) => isVisible(route.properties.id)).length;

  const renderRouteItem = (route: RouteFeature) => (
    <div key={route.properties.id} data-route-id={route.properties.id}>
      <RouteItem
        route={route}
        isSelected={selectedId === route.properties.id}
        isVisible={isVisible(route.properties.id)}
        selectMode={selectMode}
        isChecked={checkedIds.includes(route.properties.id)}
        onToggleChecked={() => toggleChecked(route.properties.id)}
        onSelect={() => selectRoute(route.properties.id)}
        onToggleVisibility={() => toggleVisibility(route.properties.id)}
        onDelete={() => {
          if (window.confirm(`Delete "${route.properties.name}"?`)) {
            void deleteRoute(route.properties.id);
          }
        }}
        onDuplicate={() => void duplicateRoute(route.properties.id)}
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
        onTagsChange={(tags) =>
          void updateRoute({
            ...route,
            properties: {
              ...route.properties,
              tags: tags.length > 0 ? tags : undefined,
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
    <aside className={`route-panel ${sheetOpen ? 'route-panel--open' : ''}`}>
      <button
        type="button"
        className="route-panel__sheet-toggle"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen((open) => !open)}
      >
        <span className="route-panel__sheet-handle" aria-hidden />
        <strong>Routes</strong>
        <span className="route-panel__count">
          {filteredRoutes.length === routes.length
            ? routes.length
            : `${filteredRoutes.length}/${routes.length}`}
        </span>
      </button>
      <div className="route-panel__header">
        <h2>Routes</h2>
        <span className="route-panel__count">
          {filteredRoutes.length === routes.length
            ? routes.length
            : `${filteredRoutes.length}/${routes.length}`}
        </span>
      </div>

      <StatsPanel
        routes={filteredRoutes}
        allRoutes={routes}
        filtered={filteredRoutes.length !== routes.length}
      />

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
        <button
          type="button"
          className={`btn btn--ghost ${selectMode ? 'btn--active' : ''}`}
          disabled={filteredRoutes.length === 0}
          onClick={() => {
            setSelectMode((open) => !open);
            setCheckedIds([]);
          }}
        >
          Select
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
            placeholder="Search name, place, or tag…"
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
            {(dateFrom || dateTo || selectedTags.length > 0 || searchQuery) && (
              <button type="button" className="btn btn--ghost btn--tiny" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
          {availableTags.length > 0 && (
            <div className="route-panel__tags" role="group" aria-label="Filter by tag">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip ${selectedTags.includes(tag) ? 'tag-chip--active' : ''}`}
                  onClick={() => toggleFilterTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectMode && (
        <div className="route-panel__bulk">
          <span>{checkedIds.length} selected</span>
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            disabled={checkedIds.length === 0}
            onClick={() => setVisibilityMany(checkedIds, false)}
          >
            Hide
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            disabled={checkedIds.length === 0}
            onClick={() => setVisibilityMany(checkedIds, true)}
          >
            Show
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            disabled={checkedIds.length === 0}
            onClick={() =>
              exportAllRoutes(
                filteredRoutes.filter((route) => checkedIds.includes(route.properties.id)),
              )
            }
          >
            Export
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            disabled={checkedIds.length < 2}
            onClick={() => {
              void mergeRoutes(checkedIds);
              setCheckedIds([]);
              setSelectMode(false);
            }}
          >
            Merge
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--tiny btn--danger"
            disabled={checkedIds.length === 0}
            onClick={handleBulkDelete}
          >
            Delete
          </button>
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
