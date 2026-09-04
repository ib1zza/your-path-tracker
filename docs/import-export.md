# Импорт и экспорт

**Модуль:** `src/lib/geo/exportImport.ts`  
**UI:** `RoutePanel` — Import menu + Export all; `RouteItem` — Export single

## Экспорт

### exportAllRoutes(routes)

Downloads `FeatureCollection` as:

```
path-tracker-routes-{Date.now()}.geojson
```

### exportRoute(route)

Single-feature collection:

```
{sanitized-name}.geojson
```

Sanitization: `name.replace(/[^\w-]+/g, '-').toLowerCase()`

Both use client-side Blob download (no server).

## Импорт

### Entry point

```typescript
routeStore.importRoutes(files, overwrite, kind?)
  → readRouteFiles(list, existingCount, kind)
  → applyImportedRoutes
  → persistRoutes → loadRoutes()
```

- **overwrite=false** + тот же `properties.id` → skipped
- **overwrite=true** → replaces existing id
- **Apple Health** (`parsed.appleHealth`): UI copy mentions start time; matching uses the same keys for all imports (id, filename clock, track time, geometry, name+distance).

### ImportKind

```typescript
type ImportKind = 'auto' | 'gpx' | 'geojson' | 'health' | 'kml' | 'tcx';
```

| Kind | Accept | Behavior |
|------|--------|----------|
| `auto` | mixed | Detect by extension |
| `gpx` | .gpx | GPX tracks/routes |
| `geojson` | .geojson, .json | FeatureCollection or Feature |
| `health` | .zip | Apple Health: only `workout-routes/*.gpx` |
| `kml` | .kml, .kmz | KML lines via togeojson |
| `tcx` | .tcx | Garmin Trackpoints XML parse |

### Auto detection (readRouteFile)

```
.gpx        → gpx
.kml/.kmz   → kml
.tcx        → tcx
.zip        → health (parseZipRoutes)
else        → geojson
```

### Supported geometry

- `LineString` — direct
- `MultiLineString` — split into multiple routes (`name (2)`, etc.)

### normalizeImportedFeature

For each imported feature:

1. Assign/reuse id (uuid if missing)
2. Extract name from properties or `Imported N`
3. Notes from `notes` or GPX `desc`
4. `extractImportedCreatedAt` for activity date
5. `simplifyLine(coords, 0.00008)`
6. `source: 'import'`
7. Calculate `distanceMeters`

### ZIP archives (parseZipRoutes)

Iterates non-directory entries:

- Filters by kind (health prefers `workout-routes` GPX)
- Per-file parse with error collection
- Throws if zero valid routes (first error message)

### GPX (parseGpxText)

Uses `@tmcw/togeojson` `gpx()` converter → filter LineString/MultiLineString features.

Fallback name from filename if track unnamed.

### KML (parseKmlText)

Uses `kml()` from togeojson.

### TCX (parseTcxText)

Custom XML parser:

- `<Activity>` or `<Course>` elements
- `<Trackpoint>` → LatitudeDegrees, LongitudeDegrees
- Sport/name from attributes or `TCX N`

### GeoJSON (parseRouteCollection)

Validates Feature or FeatureCollection with LineString geometry.

## UI import flow

```
RoutePanel → Import → menu
  → pendingKindRef + file input
  → confirm:
      Health: «matched by start time…»
      иначе: overwrite by id
  → applyImportedRoutes → "Imported N, skipped M"
```

Settings → **Delete duplicates** вызывает `removeDuplicateRoutes` (время старта **или** имя+дистанция). Оставляет первый экземпляр, удаляет остальные.

## Apple Health workflow

1. Export из Health (ZIP)
2. Import → Apple Health или Auto-detect ZIP
3. Пути `/workout-routes/i`
4. Имена GPX часто с датой и временем → `extractImportedCreatedAt` / `getRouteTimeKey`
5. Повторный импорт того же workout не плодит копии, если start time совпадает

`readRouteFiles` возвращает `{ routes, appleHealth }`. `appleHealth` true, если kind=`health` или auto нашёл Health GPX в ZIP.

## Error handling

- Per-file errors in batch: collected, continue
- Total failure: throw with first error message
- UI shows error string in `routePanel__message`

## Добавление нового формата

1. Add parser function `parseXxxText(text, existingCount)`
2. Extend `ImportKind` type
3. Wire in `readRouteFile` and `parseZipRoutes`
4. Add menu option in `RoutePanel` IMPORT_OPTIONS
5. Document in this file

## Round-trip compatibility

Export → Import preserves:

- id, name, color, notes, placeName, createdAt, distanceMeters, geometry

Re-import with overwrite replaces by id.
