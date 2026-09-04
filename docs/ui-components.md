# UI-компоненты

Стили: единый `src/index.css` с BEM-like классами. Нет CSS modules / Tailwind.

## Layout shell

### Layout (`components/Layout.tsx`)

```
app-shell
├── app-header
│   ├── brand link → /
│   ├── DrawToolbar (map only)
│   ├── GpsStatusBadge (map only)
│   └── nav: AuthButton | Map | Globe
├── GpsResumePrompt (map only)
└── app-body
    ├── RoutePanel (map only, aside)
    └── app-main → <Outlet />
```

## Pages

### MapPage

Thin wrapper: `<MapView />`

### GlobePage

- Full-height MapGL with globe projection
- Overlay panel: places grouped list
- Markers at zoom < 8 (place pins)
- Reuses `useRoutesLayer`, `useFitRouteOnSelect`
- Calls `ensurePlaceNames` on mount

## Map features

| Component | CSS root | Props / role |
|-----------|----------|--------------|
| `MapView` | `map-view` | Main map orchestrator |
| `MapControls` | `map-controls` | `{ onFinish }` |
| `DrawToolbar` | `draw-toolbar` | Mode + heatmap + my location / follow |
| `GpsStatusBadge` | `gps-badge` | Header GPS indicator |
| `GpsResumePrompt` | `gps-resume` | Draft recovery banner |
| `PlaceSearch` | `place-search` | `{ onSelect }` |
| `AuthButton` | `auth-control` | Google sign-in, Settings, sync |

### MapView sub-areas

- `map-view__search` — PlaceSearch
- `modal-backdrop` / `modal` — save dialog
- `heatmap-legend` — heatmap on

## Routes features

| Component | CSS root | Role |
|-----------|----------|------|
| `RoutePanel` | `route-panel` | Sidebar: list, import, filters |
| `RouteItem` | `route-item` | Single route row |
| `StatsPanel` | `stats-panel` | Summary stats chips |

### RoutePanel sections

- Header + count (filtered/total)
- StatsPanel
- Toolbar: Import, **Show all**, Export all
- Search (debounce 250ms, name + placeName, clear)
- Filters: group month/year/flat, date range
- Focus mode message
- Import result message
- Scrollable grouped list (scroll to selected)

### RouteItem actions

- Click row → select
- Eye → visibility
- Rename (inline)
- Notes
- **Color swatches** (`ROUTE_COLORS`) → `updateRoute` color
- Path → startEdit
- Export
- Delete → confirm

## Shared UI patterns

### Buttons

```html
<button class="btn">           <!-- default -->
<button class="btn btn--primary">
<button class="btn btn--ghost">
<button class="btn btn--active">  <!-- selected state -->
<button class="btn btn--tiny">
```

### Form fields

```html
<label class="field">
  <span>Label</span>
  <input /> or <textarea />
</label>
```

### Import menu

```
import-menu
├── btn (trigger)
├── import-menu__backdrop
└── import-menu__list
    └── import-menu__item (kind + hint)
```

### Route groups

```
route-group
├── route-group__header (collapsible)
└── route-group__body
    └── RouteItem...
```

## Hooks (not components)

Located in `features/draw/`:

- `useFreehandDraw`, `useDrawKeyboard` — `useDrawHandlers.ts`
- `useGpsDraw` — GPS watch
- `useVertexEdit` — edit mode interactions

Located in `features/map/`:

- `useRoutesLayer`, `useHeatmapLayer`, `useDrawPreviewLayer`, `useFitRouteOnSelect` — `useMapLayers.ts`
- `useMyLocationLayer` — `useMyLocation.ts`

## Auth UI

`features/auth/AuthButton.tsx` — скрыт, если Firebase не настроен. Settings: Sync now (signed-in), Sign out, Delete duplicates.

Классы: `auth-control`, `auth-status`, `auth-error`, `auth-btn--google`; меню — `import-menu` / `settings-menu__list`.

## Accessibility notes

- Save dialog: `role="dialog"`, `aria-modal`, `aria-labelledby`
- Import menu: `role="menu"`, `aria-expanded`
- Group toggle: `aria-expanded`
- Route color dots: `aria-hidden`

## Добавление нового UI

1. Prefer existing `btn`, `field`, panel patterns from index.css
2. Place feature component in `features/{area}/`
3. Wire to store via selectors, not prop drilling across features
4. Map-only UI should check route in Layout or use `useLocation`

## Globe-specific classes

- `globe-page`, `globe-page__overlay`, `globe-page__list`
- `globe-map-pin`, `globe-map-pin__label`
- `globe-page__place-btn`, `globe-page__item`, `globe-page__dot`
