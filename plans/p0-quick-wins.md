# P0 — Quick wins

Small changes with clear UX payoff. Target: 1–2 days total.

## 1. Search routes by name

**Problem:** With 50+ routes, scrolling the sidebar is slow.

**Scope:**
- Text input above the route list
- Filter by substring in `properties.name` and optional `placeName`
- Clear button, debounced input

**Effort:** ~2–4 hours

---

## 2. Fit all routes on map

**Problem:** Hard to see the full picture after importing many tracks.

**Scope:**
- Button in route panel or map toolbar: «Show all»
- Compute bbox over visible (non-hidden) routes
- `fitBounds` with padding

**Effort:** ~2 hours

---

## 3. Manual sync button

**Problem:** User cannot force refresh from Firebase or see last sync time.

**Scope:**
- «Sync now» next to auth control when logged in
- Re-run Firebase-first sync (`syncRoutesForUser`)
- Show last sync timestamp / success / error in UI

**Effort:** ~3–4 hours

---

## 4. My location on map

**Problem:** Blue dot only appears during GPS recording.

**Scope:**
- Toggle «My location» on map (Geolocation API)
- Marker + optional follow mode
- Works independently of route recording

**Effort:** ~3–4 hours

---

## 5. Route color picker

**Problem:** Colors are auto-assigned; hard to distinguish favorites.

**Scope:**
- Color swatch in selected route details
- Persist in route `properties.color`
- Syncs via existing Firebase document

**Effort:** ~2–3 hours
