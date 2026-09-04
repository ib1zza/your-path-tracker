# Карта и слои MapLibre

## Компоненты

| Файл | Роль |
|------|------|
| `MapView.tsx` | 2D OSM-карта, save dialog, click, fit-all |
| `GlobePage.tsx` | 3D globe + satellite tiles |
| `useMapLayers.ts` | Imperative слои маршрутов / heatmap / preview |
| `useMyLocation.ts` | Слой «моя локация» |
| `mapConfig.ts` | `OSM_MAP_STYLE`, default view |
| `MapControls.tsx` | Контролы при active draw |
| `PlaceSearch.tsx` | Nominatim → flyTo |
| `DrawToolbar.tsx` | Mode, heatmap, my location / follow |

## Стиль 2D-карты

Один стиль: OpenStreetMap raster (`OSM_MAP_STYLE` в `mapConfig.ts`). Переключателя dark/topo **нет**.

```typescript
DEFAULT_MAP_VIEW = { longitude: 37.6173, latitude: 55.7558, zoom: 10 }  // Moscow
```

## Globe page style

Inline `GLOBE_STYLE` в `GlobePage.tsx`:

- Esri World Imagery
- CARTO voyager labels (minzoom 5)
- `projection: globe`
- Fog/atmosphere через `setFog`

## Layer IDs

```typescript
// useMapLayers.ts
ROUTES_SOURCE_ID        = 'saved-routes'
ROUTES_OUTLINE_LAYER_ID = 'saved-routes-outline'
ROUTES_LINE_LAYER_ID    = 'saved-routes-line'
ROUTES_HIT_LAYER_ID     = 'saved-routes-hit'

HEATMAP_SOURCE_ID       = 'routes-heatmap'
HEATMAP_LAYER_ID        = 'routes-heatmap-layer'

'draw-preview' / 'draw-preview-line' / 'draw-preview-points'

// useMyLocation.ts
MY_LOCATION_SOURCE_ID   = 'my-location'
MY_LOCATION_LAYER_ID    = 'my-location-dot'
```

## useRoutesLayer

1. Сравнение `routesGeometryKey` — skip setData если геометрия та же
2. `setFeatureState` для selected (шире линия)
3. Heatmap on → opacity линий 0.22, outline скрыт

**Z-order:** heatmap → hit → outline → line → draw preview.

## useHeatmapLayer

`routesToHeatmapPoints` (cached), zoom-dependent radius, ramp blue → red.

## useDrawPreviewLayer

Оранжевая линия + точки; в edit — больше радиус, синяя выбранная вершина.

## useFitRouteOnSelect

`selectedId` → `fitMapToRoute` (padding 80, maxZoom 16).

## Fit all

`mapUiStore.fitAllNonce` → MapView вызывает `fitMapToRoutes` по маршрутам **не** в `hiddenIds` (maxZoom 14). Кнопка «Show all» в RoutePanel.

## My location

Независимо от GPS-записи. `DrawToolbar` → `toggleMyLocation`. `watchPosition` пишет Point в source; Follow (`locationFollow`) делает `easeTo` center. Слой — синий круг со светлой обводкой.

## Click handling (MapView)

| mode | onClick |
|------|---------|
| `click` | addPoint |
| `edit` | `useVertexEdit` |
| `freehand` / `gps` | ignore |
| `none` | query hit/line → selectRoute |

Hit box ~10px вокруг клика.

## Visible routes filter (MapView)

```typescript
visibleRoutes = routes.filter(route =>
  !hiddenIds.has(id) &&
  editingRouteId !== id &&
  !(selectedId && id !== selectedId)
)
```

## Place search

Debounce 350ms → `searchPlaces` → flyTo/fitBounds.

## Heatmap legend

Статический UI в MapView при `heatmapEnabled`.

## MapLibre worker

```typescript
// setupMapLibre.ts
maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.mjs`);
```

Vite-плагин в `vite.config.ts` раздаёт worker + `maplibre-gl-shared.mjs` с `/maplibre/` в dev и копирует в `dist/maplibre/` при build. Нужно, чтобы production-бандл не ломал worker.

## Добавление нового слоя

1. Константы ID в hook-файле
2. Hook `useXxxLayer(mapRef, mapLoaded, ...)`
3. Вызов из MapView/GlobePage
4. Z-order: `moveRouteLayersToTop` / `moveDrawLayersToTop` при необходимости
5. `interactiveLayerIds`, если нужен клик
