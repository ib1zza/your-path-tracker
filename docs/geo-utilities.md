# Гео-утилиты (`src/lib/geo`)

Чистые функции без React-зависимостей. Можно тестировать изолированно.

## Файлы и назначение

| Файл | Экспорты | Описание |
|------|----------|----------|
| `distance.ts` | `calculateDistanceMeters` | Turf `length` по LineString |
| `simplify.ts` | `simplifyLine` | Turf Douglas-Peucker simplify |
| `routeGeometry.ts` | `routesGeometryKey`, `thinRoute`, `thinRoutes` | Cache keys, decimation >400 pts |
| `fitBounds.ts` | `fitMapToRoute`, `fitMapToRoutes` | Turf bbox → fitBounds |
| `heatmap.ts` | `routesToHeatmapPoints` | Sample routes → weighted points |
| `stats.ts` | `computeRouteStats` | Aggregates for StatsPanel |
| `routeDate.ts` | grouping, filtering, dates, Health dedup keys | Activity dates + duplicates |
| `geocode.ts` | `searchPlaces`, `reverseGeocode`, `resolveRoutePlaceName` | Nominatim API |
| `geolocation.ts` | permission, wake lock helpers | Browser Geolocation API |
| `editGeometry.ts` | `removeSpikePoints` | GPS spike removal |
| `exportImport.ts` | parse/export functions | See import-export.md |
| `globe.ts` | `routeCentroid`, `latLngToVector3`, ... | Turf centroid + Three.js helpers |

## distance.ts

```typescript
calculateDistanceMeters(geometry: LineString): number
// Returns 0 if < 2 coordinates
// Uses @turf/turf length with units: 'meters'
```

Used whenever geometry changes (save, edit, import, thin).

## simplify.ts

```typescript
simplifyLine(coordinates, tolerance = 0.00005): Position[]
```

Default tolerance ~5m at equator. High quality Douglas-Peucker.

Used in: freehand save, import, thinRouteGeometry.

## routeGeometry.ts

### routesGeometryKey

Stable string for memoization — only id, point count, first/last coords.

### thinRouteGeometry

If `coordinates.length > 400`:
- simplify with tolerance `0.00008`
- update distanceMeters + updatedAt

Called on load (`loadRoutes`) and add/import.

## heatmap.ts

### Algorithm

1. For each route: sample points along line every `stepMeters` (25–60 based on route count)
2. Bucket into ~22m grid cells (`cellKey`)
3. Count visits per cell (same route won't double-count same cell)
4. Output Point features with `properties.visits`
5. Cap at 25,000 points

**Module-level cache** keyed by `routesGeometryKey`.

## stats.ts

```typescript
interface RouteStats {
  routeCount: number;
  totalDistanceMeters: number;
  totalDistanceLabel: string;
  uniqueCells: number;
  revisitedCells: number;  // visits >= 2
  maxVisits: number;
  hottestShare: number;    // revisitedCells / uniqueCells
}
```

Uses heatmap data internally. Cached by composite key.

## routeDate.ts

### extractImportedCreatedAt

Sources (in order):
1. `properties.createdAt` (valid ISO)
2. `properties.time`
3. `properties.coordinateProperties.times[0]` (в т.ч. вложенные массивы)
4. Дата/время в имени: `YYYY-MM-DD_HH-MM-SS`, `YYYY-MM-DD h:mm am/pm`, иначе `YYYY-MM-DD` (полдень)

### Дедуп

- `getRouteTimeKey` — минута activity time
- `getRouteLooseDedupKey` — lowercase name + distance / 100 m
- `findDuplicateRouteIds` — id всех, кроме первого совпадения по любому ключу

### groupRoutes / filterRoutesByDateRange

Без изменений: month/year/flat; HTML date inputs с локальной полуночью.

## geocode.ts

### Nominatim endpoints

- Search: `https://nominatim.openstreetmap.org/search`
- Reverse: `https://nominatim.openstreetmap.org/reverse`

Headers: `{ Accept: 'application/json' }`

### resolveRoutePlaceName

In-memory cache keyed by coords rounded to 2 decimals (~1km).

Returns `"City, Country"` format.

**Rate limiting** enforced in routeStore (1100ms), not in geocode module.

## geolocation.ts

```typescript
queryGeoPermission(): Promise<GeoPermissionState>
requestGeoPermission(): Promise<GeolocationPosition>
permissionErrorMessage(error): string
requestWakeLock(): Promise<WakeLockSentinel | null>
```

## editGeometry.ts

`removeSpikePoints(points, { minJumpMeters, spikeFactor })`:

Classic GPS glitch: A → B_far → A_near → detects via haversine median step analysis.

## globe.ts

- `routeCentroid` — Turf centroid, returns `[lng, lat] | null`
- `latLngToVector3` / `routeToGlobePoints` — Three.js sphere mapping (legacy; GlobePage uses MapLibre globe now)
- `cameraDistanceForRoute` — heuristic zoom distance

## fitBounds.ts

```typescript
fitMapToRoute(map, route, padding = 80)   // maxZoom 16
fitMapToRoutes(map, routes, padding = 80) // maxZoom 14, FeatureCollection bbox
```

## Зависимости Turf

```
@turf/turf     — length, lineString, simplify, along, centroid
@turf/bbox     — fitBounds (direct import)
```

## Кеширование

Module-level caches in:
- `heatmap.ts` (cachedResult)
- `stats.ts` (cachedStats)
- `geocode.ts` (placeCache)

Invalidate implicitly when `routesGeometryKey` changes (heatmap/stats) or new coords (geocode).

При изменении алгоритма heatmap/stats — учитывайте cache invalidation.

## Конвенции координат

- Всегда `[longitude, latitude]` (GeoJSON)
- Degrees, WGS84
- Distance in meters (haversine or Turf geodesic)
