# Управление состоянием (Zustand)

Четыре store без persist-middleware. Маршруты пишутся явно через `syncRoutes` (Dexie и при uid — Firestore). GPS draft — Dexie. UI карты (fit / my location) — только в памяти.

## routeStore

**Файл:** `src/stores/routeStore.ts`

### State

| Поле | Тип | Описание |
|------|-----|----------|
| `routes` | `RouteFeature[]` | Все маршруты, sorted by activity date desc |
| `selectedId` | `string \| null` | Выбранный маршрут (focus mode) |
| `hiddenIds` | `Set<string>` | Скрытые на карте |
| `isLoading` | `boolean` | Загрузка / sync |
| `heatmapEnabled` | `boolean` | Overlay heatmap |

Стиль карты и `mapStyleId` в store **нет**: 2D всегда OSM (`OSM_MAP_STYLE`).

### Actions

| Action | Описание |
|--------|----------|
| `loadRoutes()` | `loadRoutesForCurrentUser` → thin → date backfill → persist changes → sort → deferred `ensurePlaceNames` |
| `addRoute(route)` | thin → `persistRoute` → prepend → geocode |
| `updateRoute(route)` | `persistRoute` → replace in state |
| `deleteRoute(id)` | `removeRoute` + clear selection/hidden |
| `selectRoute` / `toggleVisibility` / `isVisible` / `toggleHeatmap` | UI-only |
| `ensurePlaceNames()` | Reverse geocode без placeName (1100 ms gap), затем `persistRoutes` |
| `importRoutes` / `applyImportedRoutes` | Parse → skip/overwrite по id; Health ещё по start time → `persistRoutes` → `loadRoutes` |
| `applyRoutes(routes)` | Только Zustand (после cloud sync, без повторной записи) |
| `removeDuplicateRoutes()` | `findDuplicateRouteIds` → `removeRoute` для каждого |

### Singleton guard

`placeNamesInFlight` — один проход `ensurePlaceNames` за раз.

## authStore

**Файл:** `src/stores/authStore.ts`

Сессия Google, флаги sync, `init` / `signIn` / `signOut` / `syncNow`. После успешного sync вызывает `routeStore.applyRoutes`. Если Firebase не настроен, `init` сразу грузит маршруты из Dexie. Подробности: [firebase-sync.md](./firebase-sync.md).

## mapUiStore

**Файл:** `src/stores/mapUiStore.ts`

| Поле / action | Описание |
|---------------|----------|
| `fitAllNonce` | Инкремент → MapView делает `fitMapToRoutes` по видимым (не hidden) маршрутам |
| `requestFitAllRoutes()` | Кнопка «Show all» в RoutePanel |
| `showMyLocation` / `toggleMyLocation` | Синяя точка, независимо от GPS-записи |
| `locationFollow` / `toggleLocationFollow` | Карта следует за точкой (сбрасывается при выключении location) |

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
| `points` | `Position[]` | Точки рисунка / редактирования |
| `isFreehandActive` | `boolean` | Drag в freehand |
| `editingRouteId` | `string \| null` | Маршрут в edit mode |
| `selectedPointIndex` | `number \| null` | Вершина в edit |
| `gpsWatchId` | `number \| null` | geolocation watch ID |
| `gpsError` | `string \| null` | Ошибка GPS |
| `gpsPermission` | `GeoPermissionState` | granted/prompt/denied/... |
| `gpsPaused` | `boolean` | GPS на паузе |
| `gpsFollow` | `boolean` | Карта следует за записью GPS |
| `gpsAccuracy` | `number \| null` | meters |
| `gpsStartedAt` | `string \| null` | ISO начала сессии |
| `gpsWakeLock` | `WakeLockSentinel \| null` | Screen wake lock |

### Ключевые actions

| Action | Поведение |
|--------|-----------|
| `setMode(mode)` | Stop GPS watch, release wake lock, clear draft if leaving gps, reset points |
| `startEdit(routeId, points)` | mode=edit, copy coordinates |
| `startGpsRecording()` | Permission → wake lock → empty draft → mode=gps |
| `resumeGpsDraft()` | Load draft from DB → mode=gps |
| `pauseGps` / `resumeGps` | watch + wake lock + persist draft |
| `addPoint` / `updatePoint` / `removePointAt` | Манипуляция points |
| `cleanGpsSpikes()` | `removeSpikePoints` |
| `persistGpsDraft()` | Debounced Dexie (из useGpsDraw) |
| `clearGpsSession()` / `cancel()` / `reset()` | Очистка сессии / полный сброс / только points |

### Side effects при смене mode

Уход с `gps` → `clearGpsDraft()`, если не сохранили через MapView.

## Взаимодействие stores

```
App
  └─ authStore.init → sync / loadRoutes → routeStore

MapView
  ├─ drawStore (preview, mode)
  ├─ routeStore (saved routes, selection)
  └─ mapUiStore (fit all, my location)

RoutePanel
  ├─ routeStore (list, CRUD, import)
  ├─ mapUiStore.requestFitAllRoutes
  └─ drawStore.startEdit

AuthButton
  ├─ authStore (sign in/out, syncNow)
  └─ routeStore.removeDuplicateRoutes

save flow (MapView.handleSaveRoute):
  drawStore.points → RouteFeature → routeStore.addRoute → drawStore.reset
```

## Подписки в компонентах

Селекторы:

```typescript
const routes = useRouteStore((state) => state.routes);
const mode = useDrawStore((state) => state.mode);
```

Imperative в callbacks:

```typescript
useDrawStore.getState().points
useRouteStore.getState().routes
```

## Что НЕ в store

- Map instance / mapLoaded — local state в MapView/GlobePage
- Save dialog open/name/notes — local state в MapView
- Import / search / date filters — local state в RoutePanel
- Place search results — local state в PlaceSearch
- Settings menu — local state в AuthButton
