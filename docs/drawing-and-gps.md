# Рисование и GPS

## Режимы рисования

| Mode | UI trigger | Hook / handler | Завершение |
|------|------------|----------------|------------|
| `click` | DrawToolbar "Click" | MapView onClick → addPoint | Enter или "Finish route" |
| `freehand` | DrawToolbar "Freehand" | `useFreehandDraw` | mouseup после drag |
| `gps` | DrawToolbar "GPS" | `useGpsDraw` + drawStore | Finish route (pause first) |
| `edit` | RoutePanel "Path" button | `useVertexEdit` | Save edits (instant, no modal) |
| `none` | Cancel / after save | — | — |

Toggle active mode button → `cancel()`.

## Click mode

- Crosshair cursor
- Each click appends `[lng, lat]` to `drawStore.points`
- Preview line appears after 2+ points
- Keyboard: Backspace/Ctrl+Z undo, Enter finish, Esc cancel

## Freehand mode

**Hook:** `src/features/draw/useDrawHandlers.ts` → `useFreehandDraw`

- mousedown → start drawing, disable dragPan
- mousemove → append if distance > `0.00003` deg (~3m)
- mouseup → `onComplete()` → opens save dialog
- `dragPan={false}` on Map during freehand (MapView prop)

On save: coordinates passed through `simplifyLine` (tolerance 0.00005).

## GPS mode

### Start flow

```
DrawToolbar → startGpsRecording()
  → queryGeoPermission / requestGeoPermission
  → requestWakeLock()
  → saveGpsDraft({ active: true, points: [] })
  → mode = 'gps'
```

### Recording (`useGpsDraw`)

- `watchPosition` with `enableHighAccuracy: true`
- Skip points if accuracy > 55m
- Min distance between points: `0.00002` deg (~2m)
- Autosave draft every 800ms debounce
- If `gpsFollow`: map easeTo center, min zoom 16
- On tab visible again: re-request wake lock

### Pause / Resume

- Pause: stop watch, release wake lock, persist draft
- Resume: restart watch (effect re-runs when gpsPaused=false)
- Save dialog auto-pauses GPS before opening

### Draft recovery

`GpsResumePrompt` checks `getGpsDraft()` when mode !== 'gps':

- Shows banner if `active && points.length >= 2`
- Resume → `resumeGpsDraft()`
- Discard → `clearGpsSession()`

### Save GPS route

Same modal as click draw; `source: 'gps'`, name prefix "GPS {date time}".

After save: `clearGpsSession()`.

## Edit mode (vertex editing)

**Hook:** `src/features/draw/useVertexEdit.ts`

| Action | Input |
|--------|-------|
| Select vertex | Click near point (14px hit radius) |
| Move vertex | Drag |
| Delete vertex | Select + Delete/Backspace, or double-click |
| Add vertex | Shift+click on map |
| Undo last | Ctrl+Z |
| Clean GPS spikes | MapControls button → `removeSpikePoints` |

Constraints:
- Minimum 2 points (can't delete below 2)
- Saved route hidden on map while editing; preview layer shows edits
- Save: direct `updateRoute` without name modal

### Spike cleaning

`editGeometry.removeSpikePoints`:

- Detects jump-away-and-back pattern
- Threshold: max(80m, medianStep * 6)
- Also drops isolated bad endpoints

## Keyboard shortcuts

Handled in `useDrawKeyboard` (global listener, skips input/textarea):

| Key | click/freehand | gps | edit |
|-----|----------------|-----|------|
| Escape | cancel | cancel | cancel |
| Enter | finish (≥2 pts) | finish | finish |
| Backspace/Delete | undo | — | delete point |
| Ctrl/Cmd+Z | undo | — | undo |

## MapControls UI

Shown when `mode !== 'none'`. Context-specific hints and actions:

- Cancel, Undo, Finish
- GPS: Pause, Resume, Follow toggle
- Edit: Delete point, Clean spikes

## GpsStatusBadge

Header badge during GPS: Recording/Paused, point count, distance, accuracy.

## Finish → Save dialog

`MapView.openSaveDialog`:

1. Edit mode → immediate updateRoute + cancelDraw
2. GPS not paused → pause first
3. Otherwise → modal with name, notes, point count, distance

`handleSaveRoute`:

1. Simplify if freehand
2. Build RouteFeature with uuid, pickRouteColor
3. Optional inline geocode (resolveRoutePlaceName)
4. addRoute → fitMapToRoute → clear GPS if needed

## Типичные баги / edge cases

- Leaving GPS without save clears draft (`setMode` / `cancel`)
- Permission denied → error in gps panel + retry button
- Edit mode disables doubleClickZoom
- Freehand re-enables dragPan on cleanup
