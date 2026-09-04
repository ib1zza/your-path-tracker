# Руководство для AI-агентов

Этот документ — быстрый онбординг coding-агентов в **your-path-tracker** (Path Tracker).

## Что это за проект (one-liner)

SPA: рисование/GPS/импорт маршрутов → GeoJSON → IndexedDB (кэш) ± Firestore → MapLibre карта + globe + heatmap. Firebase опционален.

## Первые файлы для чтения

1. `src/types/route.ts` — модель данных
2. `src/stores/routeStore.ts` + `drawStore.ts` + `authStore.ts` + `mapUiStore.ts`
3. `src/features/map/MapView.tsx` — orchestrator карты
4. `src/lib/firebase/syncRoutes.ts` + `src/db/routesDb.ts` — persistence
5. `src/lib/geo/exportImport.ts` — импорт/экспорт

## Карта «где что менять»

| Задача | Куда смотреть |
|--------|---------------|
| Новый формат импорта | `lib/geo/exportImport.ts`, `RoutePanel` IMPORT_OPTIONS |
| Отображение маршрутов | `useMapLayers.ts` |
| Режим рисования | `drawStore` DrawMode + `features/draw/` + `DrawToolbar` |
| CRUD маршрутов | `routeStore.ts` → `syncRoutes.ts` (не прямой Dexie из UI) |
| Auth / cloud sync | `authStore.ts`, `lib/firebase/*`, `AuthButton` |
| Fit all / my location | `mapUiStore.ts`, `fitBounds.ts`, `useMyLocation.ts` |
| Поле у маршрута | `types/route.ts` → import normalize → RouteItem |
| Геокодинг / поиск | `lib/geo/geocode.ts`, `PlaceSearch.tsx` |
| Статистика / heatmap | `lib/geo/heatmap.ts`, `stats.ts` |
| Стиль 2D-карты | `mapConfig.ts` (`OSM_MAP_STYLE`); Globe — `GlobePage` GLOBE_STYLE |
| CSS / layout | `index.css`, `Layout.tsx` |
| Dexie schema | `db/routesDb.ts` version bump |
| Firestore документ | `db/routesFirestore.ts`, `firestore.rules` |

## Инварианты (не ломать)

1. **GeoJSON coord order**: `[lng, lat]`
2. **Route id**: `properties.id` = Dexie key = MapLibre `promoteId`
3. **Min 2 points** для LineString
4. **thinRoutes** на load — не отключать без причины
5. **Nominatim rate limit** — не reverse geocode в tight loop
6. **GPS draft** — `clearGpsDraft` при cancel/уходе с gps; draft не в Firestore
7. **Focus mode** — `selectedId` скрывает другие routes (MapView filter)
8. **Persistence** — CRUD через `persistRoute` / `persistRoutes` / `removeRoute`
9. **Firebase-first** — непустой cloud затирает локальный кэш при sync
10. **Firestore** — без `undefined` в документе (`sanitizeForFirestore`)

## Архитектурные правила

```
lib/geo  →  stores  →  features  →  pages
lib/firebase ↗     ↘ db ↗
```

- Не импортировать React components из `lib/`
- Не хранить Map instance в Zustand
- Слои карты — imperative hooks, не `<Source>`/`<Layer>` для routes
- Side effects persistence — в store actions

## Частые паттерны кода

### Read store imperatively in callback

```typescript
const state = useDrawStore.getState();
useRouteStore.getState().routes.find(...)
```

### Stable memo key for routes geometry

```typescript
const geometryKey = useMemo(() => routesGeometryKey(routes), [routes]);
```

### Save route from points

```typescript
const geometry = { type: 'LineString' as const, coordinates: points };
const distanceMeters = calculateDistanceMeters(geometry);
// → RouteFeature → addRoute → persistRoute
```

## Скрипты

```bash
yarn install
yarn dev         # разработка
yarn build       # typecheck + bundle
yarn lint        # oxlint
yarn format      # Prettier
make check       # lint + format-check + build
```

Тестов нет — проверяйте вручную (чеклист в getting-started). Пакетный менеджер — **Yarn 4**, не npm (`yarn.lock`).

## Git / commits

Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`  
GitLab issues: `#123` в сообщениях, если есть номер.

**Не коммитить** без явной просьбы пользователя.

## Scope discipline

- Минимальный diff
- Не рефакторить unrelated code
- Не добавлять тесты/docs unless requested
- Match existing naming

## External services

| Service | Usage |
|---------|-------|
| tile.openstreetmap.org | OSM 2D basemap |
| server.arcgisonline.com | Globe satellite |
| basemaps.cartocdn.com | Globe labels |
| nominatim.openstreetmap.org | Search + reverse geocode |
| Firebase Auth / Firestore | Опционально, `VITE_FIREBASE_*` |

## Debugging tips

- **Routes not showing**: visibleRoutes (hiddenIds, selectedId, editingRouteId)
- **Selection highlight lost**: setData clears feature-state — useRoutesLayer re-applies
- **Import date / Health dupes**: `extractImportedCreatedAt`, `getRouteTimeKey`, `applyImportedRoutes`
- **GPS not recording**: permission, accuracy >55m, gpsPaused
- **Map blank after deploy**: worker `/maplibre/maplibre-gl-worker.mjs` (vite plugin)
- **Sign-in hidden**: нет полного `.env`
- **Cloud overwrote local**: ожидаемо, если Firestore документ непустой
- **Sync stuck**: `authStore.error` / `syncStatus`

## Документация

Индекс: [README.md](./README.md). Auth/sync: [firebase-sync.md](./firebase-sync.md).

## Пример flow: добавить поле `tags: string[]`

1. `RouteProperties` в `types/route.ts`
2. `normalizeImportedFeature` — optional import
3. `MapView.handleSaveRoute` — если нужно при create
4. `RouteItem` — UI
5. `updateRoute` → `persistRoute` (Dexie + Firestore)
6. Export/import через GeoJSON properties
7. Dexie schema не менять (целый объект). Firestore: не писать `undefined`

## Пример flow: новый 2D basemap

Сейчас стиль один (`OSM_MAP_STYLE`). Чтобы вернуть переключатель:

1. Стили в `mapConfig.ts`
2. Состояние (store или local) + `mapStyle` на `<Map>` в `MapView`
3. UI в `DrawToolbar`

## Контакты / product name

- App title: **Path Tracker**
- Package name: `your-path-tracker`
- Default map center: Moscow (55.7558, 37.6173)
