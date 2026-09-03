# Руководство для AI-агентов

Этот документ оптимизирован для быстрого онбординга coding-агентов в репозиторий **your-path-tracker** (Path Tracker).

## Что это за проект (one-liner)

Offline-first SPA: рисование/GPS/импорт маршрутов → GeoJSON в IndexedDB → MapLibre карта + 3D globe + heatmap.

## Первые файлы для чтения

1. `src/types/route.ts` — модель данных
2. `src/stores/routeStore.ts` + `src/stores/drawStore.ts` — бизнес-логика
3. `src/features/map/MapView.tsx` — главный orchestrator
4. `src/db/routesDb.ts` — persistence
5. `src/lib/geo/exportImport.ts` — если задача про импорт/экспорт

## Карта «где что менять»

| Задача | Куда смотреть |
|--------|---------------|
| Новый формат импорта | `lib/geo/exportImport.ts`, `RoutePanel` IMPORT_OPTIONS |
| Изменить отображение маршрутов | `useMapLayers.ts` |
| Новый режим рисования | `drawStore` DrawMode + hook в `features/draw/` + `DrawToolbar` |
| CRUD / сортировка маршрутов | `routeStore.ts` |
| Новое поле у маршрута | `types/route.ts` → import normalize → UI RouteItem |
| Геокодинг / поиск | `lib/geo/geocode.ts`, `PlaceSearch.tsx` |
| Статистика / heatmap algo | `lib/geo/heatmap.ts`, `stats.ts` |
| Стили карты | `mapConfig.ts`, `GlobePage` GLOBE_STYLE |
| CSS / layout | `index.css`, `Layout.tsx` |
| DB migration | `db/routesDb.ts` Dexie version bump |

## Инварианты (не ломать)

1. **GeoJSON coord order**: `[lng, lat]` always
2. **Route id**: `properties.id` = Dexie key = MapLibre promoteId
3. **Min 2 points** для LineString маршрута
4. **thinRoutes** на load — не отключать без причины (perf)
5. **Nominatim rate limit** — не вызывать reverse geocode в tight loop
6. **GPS draft** — `clearGpsDraft` при cancel/setMode away from gps
7. **Focus mode** — selectedId скрывает другие routes на карте (MapView filter)

## Архитектурные правила

```
lib/geo  →  stores  →  features  →  pages
         ↘ db ↗
```

- Не импортировать React components из `lib/`
- Не хранить Map instance в Zustand
- Map layers — imperative hooks, не react-map-gl `<Source>`/`<Layer>` для routes
- Side effects persistence — в store actions, не в components (кроме one-off geocode on save)

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
// → RouteFeature → addRoute
```

## Скрипты

```bash
npm run dev     # разработка
npm run build   # typecheck + bundle
npm run lint    # oxlint
```

Тестов нет — проверяйте вручную в браузере.

## Git / commits

Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`  
Reference GitLab issues: `#123` in messages if applicable.

**Не коммитить** без явной просьбы пользователя.

## Scope discipline

- Минимальный diff
- Не рефакторить unrelated code
- Не добавлять тесты/docs unless requested (docs уже в /docs)
- Match existing naming, no over-abstraction

## External services (no API keys)

| Service | Usage |
|---------|-------|
| tile.openstreetmap.org | OSM basemap |
| basemaps.cartocdn.com | Dark + labels |
| tile.opentopomap.org | Topo |
| server.arcgisonline.com | Globe satellite |
| nominatim.openstreetmap.org | Search + reverse geocode |

## Debugging tips

- **Routes not showing**: check visibleRoutes filter (hiddenIds, selectedId, editingRouteId)
- **Selection highlight lost**: setData clears feature-state — useRoutesLayer re-applies
- **Import date wrong**: check extractImportedCreatedAt + loadRoutes backfill logic
- **GPS not recording**: permission, accuracy >55m filter, gpsPaused
- **Map blank after style change**: expected remount; wait for onLoad

## Документация

Полный index: [README.md](./README.md)

## Пример flow: добавить поле `tags: string[]` к маршруту

1. Extend `RouteProperties` in `types/route.ts`
2. `normalizeImportedFeature` — optional import
3. `MapView.handleSaveRoute` — if needed on create
4. `RouteItem` — UI to edit tags
5. `updateRoute` already persists full feature
6. Export/import round-trip automatic via GeoJSON properties
7. No DB schema change (Dexie stores whole object)

## Пример flow: новый basemap style

1. Add to `MapStyleId` union in `mapConfig.ts`
2. Add entry in `MAP_STYLES`
3. Update `loadMapStyle()` valid values in routeStore
4. DrawToolbar select auto-populates from `Object.keys(MAP_STYLES)`

## Контакты / product name

- App title: **Path Tracker**
- Package name: `your-path-tracker`
- Default map center: Moscow (55.7558, 37.6173)
