# Модель данных

## RouteFeature

Основной тип маршрута — GeoJSON Feature с LineString geometry.

```typescript
// src/types/route.ts

interface RouteProperties {
  id: string;              // UUID, primary key
  name: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  color: string;           // hex, из ROUTE_COLORS
  notes?: string;
  placeName?: string;      // "City, Country" из Nominatim
  source?: 'draw' | 'gps' | 'import';
  distanceMeters: number;  // Turf length, пересчитывается при изменении geometry
}

type RouteFeature = Feature<LineString, RouteProperties>;
type RouteCollection = FeatureCollection<LineString, RouteProperties>;
```

### Координаты

GeoJSON порядок: `[longitude, latitude]` (опционально elevation как 3-й элемент).

### Цвета маршрутов

```typescript
const ROUTE_COLORS = [
  '#e53935', '#1e88e5', '#43a047', '#fb8c00',
  '#8e24aa', '#00acc1', '#6d4c41', '#d81b60',
];
// pickRouteColor(index) — index % 8
```

## IndexedDB (Dexie)

База: `PathTrackerDB`

### Schema v1

```
routes: 'properties.id, properties.name, properties.createdAt'
```

### Schema v2 (+ gpsDraft)

```
routes: 'properties.id, properties.name, properties.createdAt'
gpsDraft: 'id'
```

### Таблица `routes`

- **Key**: `route.properties.id`
- **Value**: полный `RouteFeature` объект
- **Индексы**: name, createdAt (для сортировки/запросов)

### Таблица `gpsDraft`

Единственная запись с `id = 'current'`:

```typescript
interface GpsDraft {
  id: string;           // always 'current'
  points: Position[];
  startedAt: string;
  updatedAt: string;
  active: boolean;
  paused: boolean;
}
```

Используется для восстановления незавершённой GPS-сессии после reload.

## API базы данных

```typescript
// src/db/routesDb.ts

getAllRoutes(): Promise<RouteFeature[]>
saveRoute(route: RouteFeature): Promise<void>
saveRoutes(routes: RouteFeature[]): Promise<void>  // bulkPut
deleteRoute(id: string): Promise<void>

getGpsDraft(): Promise<GpsDraft | undefined>
saveGpsDraft(draft: Omit<GpsDraft, 'id'>): Promise<void>
clearGpsDraft(): Promise<void>
```

## Дата активности маршрута

Для сортировки и группировки используется **activity date**, не обязательно `createdAt`:

```typescript
getRouteActivityDate(route): Date
```

Приоритет:
1. Дата из имени (`YYYY-MM-DD` regex)
2. `properties.createdAt`

При импорте GPX/Health `extractImportedCreatedAt` пытается извлечь дату из properties (`time`, `coordinateProperties.times`) или имени файла.

## Упрощение геометрии

При load/save/import маршруты с **>400 точек** упрощаются Douglas-Peucker (tolerance `0.00008`):

- `thinRouteGeometry(route)` → возможно обновлённый route
- `distanceMeters` пересчитывается после упрощения

Ключ для React memoization без учёта metadata:

```typescript
routesGeometryKey(routes): string
// "id:pointCount:firstCoord:lastCoord|..."
```

## MapLibre GeoJSON source

При рендере на карте properties обрезаются до:

```typescript
{ id, color, name }
```

`promoteId: 'id'` — для `setFeatureState({ selected: true })`.

## Export format

Export = `FeatureCollection` с полными `RouteFeature` (все properties сохраняются).

Имена файлов:
- All: `path-tracker-routes-{timestamp}.geojson`
- Single: `{sanitized-name}.geojson`
