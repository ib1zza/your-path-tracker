# Управление состоянием (Zustand)

Два независимых store без middleware и persist plugins — persistence делается явно через Dexie.

## routeStore

**Файл:** `src/stores/routeStore.ts`

### State

| Поле | Тип | Описание |
|------|-----|----------|
| `routes` | `RouteFeature[]` | Все маршруты, sorted by activity date desc |
| `selectedId` | `string \| null` | Выбранный маршрут (focus mode) |
| `hiddenIds` | `Set<string>` | Скрытые на карте (toggle visibility) |
| `isLoading` | `boolean` | Загрузка из IndexedDB |
| `heatmapEnabled` | `boolean` | Overlay heatmap |
| `mapStyleId` | `MapStyleId` | `osm` \| `dark` \| `topo`, persisted in localStorage |

### Actions

| Action | Описание |
|--------|----------|
| `loadRoutes()` | DB → thinRoutes → date backfill → save changes → sort → deferred `ensurePlaceNames` |
| `addRoute(route)` | thin → saveRoute → prepend to routes → geocode |
| `updateRoute(route)` | saveRoute → map replace |
| `deleteRoute(id)` | delete from DB + state, clear selection/hidden |
| `selectRoute(id)` | Set selectedId |
| `toggleVisibility(id)` | Toggle in hiddenIds |
| `isVisible(id)` | `!hiddenIds.has(id)` |
| `toggleHeatmap()` | Flip heatmapEnabled |
| `setMapStyleId(id)` | localStorage + state |
| `ensurePlaceNames()` | Reverse geocode routes without placeName (serialized, 1100ms gap) |
| `importRoutes(files, overwrite, kind?)` | Parse → dedupe by id → save → reload |

### Singleton guard

`placeNamesInFlight` — предотвращает параллельные вызовы `ensurePlaceNames`.

## drawStore

**Файл:** `src/stores/drawStore.ts`

### DrawMode

```typescript
type DrawMode = 'none' | 'click' | 'freehand' | 'gps' | 'edit';
```

### State

| Поле | Тип | Описание |
|------|-----|----------|
| `mode` | `DrawMode` | Текущий режим |
| `points` | `Position[]` | Точки текущего рисунка / редактирования |
| `isFreehandActive` | `boolean` | Идёт ли drag в freehand |
| `editingRouteId` | `string \| null` | ID маршрута в edit mode |
| `selectedPointIndex` | `number \| null` | Выбранная вершина в edit |
| `gpsWatchId` | `number \| null` | navigator.geolocation watch ID |
| `gpsError` | `string \| null` | Сообщение об ошибке GPS |
| `gpsPermission` | `GeoPermissionState` | granted/prompt/denied/... |
| `gpsPaused` | `boolean` | GPS на паузе |
| `gpsFollow` | `boolean` | Карта следует за позицией |
| `gpsAccuracy` | `number \| null` | meters |
| `gpsStartedAt` | `string \| null` | ISO timestamp начала сессии |
| `gpsWakeLock` | `WakeLockSentinel \| null` | Screen wake lock |

### Ключевые actions

| Action | Поведение |
|--------|-----------|
| `setMode(mode)` | Stop GPS watch, release wake lock, clear draft if leaving gps, reset points |
| `startEdit(routeId, points)` | mode=edit, copy coordinates |
| `startGpsRecording()` | Permission check → wake lock → save empty draft → mode=gps |
| `resumeGpsDraft()` | Load draft from DB → mode=gps |
| `pauseGps()` | clearWatch, release wake lock, persist draft |
| `resumeGps()` | gpsPaused=false, re-request wake lock |
| `addPoint` / `updatePoint` / `removePointAt` | Манипуляция points |
| `cleanGpsSpikes()` | `removeSpikePoints` from editGeometry |
| `persistGpsDraft()` | Debounced save to IndexedDB (from useGpsDraw) |
| `clearGpsSession()` | Stop watch, clear draft |
| `cancel()` | Full reset to mode=none |
| `reset()` | Clear points only (keep mode) |

### Side effects при смене mode

Leaving `gps` mode → `clearGpsDraft()` unless explicitly saved via MapView save flow.

## Взаимодействие stores

```
MapView
  ├─ drawStore (preview, mode)
  └─ routeStore (saved routes, selection)

RoutePanel
  ├─ routeStore (list, CRUD, import)
  └─ drawStore.startEdit (edit button)

save flow (MapView.handleSaveRoute):
  drawStore.points → RouteFeature → routeStore.addRoute → drawStore.reset/setMode('none')
```

## Подписки в компонентах

Используйте селекторы для минимизации re-renders:

```typescript
const routes = useRouteStore((state) => state.routes);
const mode = useDrawStore((state) => state.mode);
```

Для imperative access в callbacks:

```typescript
useDrawStore.getState().points
useRouteStore.getState().routes
```

## Что НЕ в store

- Map instance / mapLoaded — local state в MapView/GlobePage
- Save dialog open/name/notes — local state в MapView
- Import menu open — local state в RoutePanel
- Place search results — local state в PlaceSearch
