# P3 — Future / external dependencies

Ideas that need third-party APIs, billing, or significant architecture.

## 1. Snap to roads / paths

Match GPS tracks to OSM ways via Mapbox Map Matching, OSRM, or Valhalla.

- Requires API key and usage limits
- Best for noisy GPS in cities

**Effort:** ~1 week + ongoing API cost

---

## 2. Elevation profile

Chart altitude vs distance for routes with Z coordinate or external DEM lookup.

- GPX often has elevation
- Health exports may not

**Effort:** ~1 week

---

## 3. Share read-only link

Public URL to view one route or whole map without login.

- Firebase Hosting + security rules or Cloud Function token
- Privacy review required

**Effort:** ~1–2 weeks

---

## 4. Strava / Garmin direct import

OAuth integration instead of manual GPX export.

- Strava API approval process
- Token storage and refresh

**Effort:** ~2+ weeks

---

## 5. Real-time multi-device sync

Live Firestore listeners instead of sync-on-login + manual save document.

- `onSnapshot` on `users/{uid}/sync/routes`
- Conflict strategy if two devices edit simultaneously

**Effort:** ~1 week (refactor from single-doc snapshot model)

---

## 6. Team / shared maps

Multiple users contributing to one route collection.

- Firestore rules, shared collection IDs, invite flow

**Effort:** ~2+ weeks
