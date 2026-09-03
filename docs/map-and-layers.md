# Карта и слои MapLibre

## Компоненты

| Файл | Роль |
|------|------|
| `MapView.tsx` | Главная 2D-карта, save dialog, click handling |
| `GlobePage.tsx` | 3D globe projection + satellite tiles |
| `useMapLayers.ts` | Imperative layer management hooks |
| `mapConfig.ts` | Стили карты, default view |
| `MapControls.tsx` | Floating controls при active draw mode |
| `PlaceSearch.tsx` | Nominatim search → flyTo/fitBounds |
| `DrawToolbar.tsx` | Mode buttons, heatmap, style select |

## Стили карты (2D)

```typescript
// mapConfig.ts
MAP_STYLES = {
  osm:   OpenStreetMap raster tiles
  dark:  CARTO dark_all
  topo:  OpenTopoMap (maxzoom 17)
}
DEFAULT_MAP_VIEW = { lng: 37.6173, lat: 55.7558, zoom: 10 }  // Moscow default
```

`mapStyleId` меняет `key` на `<Map>` → remount → `mapLoaded` reset.

## Globe page style

Inline `GLOBE_STYLE` в `GlobePage.tsx`:

- Esri World Imagery (satellite)
- CARTO voyager labels overlay (minzoom 5)
- `projection: globe`
- Custom fog/atmosphere via `setFog`

## Layer IDs (константы)

```typescript
// useMapLayers.ts
ROUTES_SOURCE_ID       = 'saved-routes'
ROUTES_OUTLINE_LAYER_ID = 'saved-routes-outline'  // white halo
ROUTES_LINE_LAYER_ID    = 'saved-routes-line'     // colored line
ROUTES_HIT_LAYER_ID     = 'saved-routes-hit'      // invisible 22px hit area

HEATMAP_SOURCE_ID       = 'routes-heatmap'
HEATMAP_LAYER_ID        = 'routes-heatmap-layer'

// draw preview
'saved-routes' source sibling:
  'draw-preview' source
  'draw-preview-line'
  'draw-preview-points'
```

## useRoutesLayer

Синхронизирует GeoJSON source с массивом routes:

1. Compare `routesGeometryKey` — skip setData if unchanged
2. `setFeatureState` for selected route (wider line)
3. When heatmap enabled: reduce line opacity to 0.22, hide outline

**Z-order:** heatmap → hit → outline → line → draw preview (always on top)

## useHeatmapLayer

- Data from `routesToHeatmapPoints(routes)` (cached)
- MapLibre `heatmap` layer with zoom-dependent radius/intensity
- Blue → green → yellow → orange → red color ramp
- Visibility toggled via layout/paint properties

## useDrawPreviewLayer

- Orange line + circle points
- In edit mode: larger radius, blue selected vertex via feature-state
- `promoteId: 'id'` on point features (index as id)

## useFitRouteOnSelect

On `selectedId` change → `fitMapToRoute(map, route)` with Turf bbox, padding 80, maxZoom 16.

## Click handling (MapView)

| mode | onClick behavior |
|------|------------------|
| `click` | addPoint at lngLat |
| `edit` | handled by useVertexEdit |
| `freehand` / `gps` | ignored |
| `none` | queryRenderedFeatures on hit/line layers → selectRoute |

Hit detection uses 10px padding box around click point.

## Visible routes filter (MapView)

```typescript
visibleRoutes = routes.filter(route =>
  !hiddenIds.has(id) &&
  !(editingRouteId === id) &&      // preview replaces saved
  !(selectedId && id !== selectedId) // focus mode
)
```

## Place search

`PlaceSearch` → debounced 350ms → `searchPlaces(query)` → dropdown → parent flies map.

## Heatmap legend

Static UI in MapView when `heatmapEnabled` — not tied to layer data.

## MapLibre setup

```typescript
// setupMapLibre.ts
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
maplibregl.setWorkerUrl(maplibreWorker);
```

Required for Vite bundling; imported once in `main.tsx`.

## Добавление нового слоя

1. Define source/layer IDs as exported constants in `useMapLayers.ts`
2. Create hook `useXxxLayer(mapRef, mapLoaded, ...)`
3. Call from MapView/GlobePage
4. Update `moveRouteLayersToTop` / `moveDrawLayersToTop` if z-order matters
5. Add layer ID to `interactiveLayerIds` if needs click events
