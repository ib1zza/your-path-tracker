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
│   └── nav: Map | Globe
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
| `DrawToolbar` | `draw-toolbar` | Mode + heatmap + style |
| `GpsStatusBadge` | `gps-badge` | Header GPS indicator |
| `GpsResumePrompt` | `gps-resume` | Draft recovery banner |
| `PlaceSearch` | `place-search` | `{ onSelect }` |

### MapView sub-areas

- `map-view__search` — top overlay for PlaceSearch
- `modal-backdrop` / `modal` — save route dialog
- `heatmap-legend` — when heatmap on

## Routes features

| Component | CSS root | Role |
|-----------|----------|------|
| `RoutePanel` | `route-panel` | Sidebar: list, import, filters |
| `RouteItem` | `route-item` | Single route row |
| `StatsPanel` | `stats-panel` | Summary stats chips |

### RoutePanel sections

- Header + count
- StatsPanel
- Toolbar: Import menu, Export all
- Filters: group by month/year/flat, date range
- Focus mode message
- Import result message
- Scrollable grouped list

### RouteItem actions

- Click row → select
- Eye toggle → visibility
- Rename (inline input)
- Notes textarea
- Path → startEdit
- Export → exportRoute
- Delete → confirm + deleteRoute

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
