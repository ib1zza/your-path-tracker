# P1 — Core UX

Features that improve everyday workflow. Target: ~1 week each or batch in a sprint.

## 1. Tags / labels

**Problem:** Notes are free text; no structured filtering.

**Scope:**
- `properties.tags: string[]` on routes
- Add/remove tags in route detail
- Filter sidebar by tag (multi-select)
- Include tags in search (P0)

**Effort:** ~1–2 days

---

## 2. Duplicate route

**Problem:** User wants a copy to edit without losing the original.

**Scope:**
- «Duplicate» action on route item
- New UUID, name suffix «(copy)», same geometry
- Cloud + local persist

**Effort:** ~half day

---

## 3. Bulk actions

**Problem:** Deleting or hiding many routes one-by-one is tedious.

**Scope:**
- Multi-select mode in route list
- Bulk: hide, show, delete, export selected
- Confirm dialog for destructive actions

**Effort:** ~2 days

---

## 4. Period statistics

**Problem:** Date filter exists but totals for the filtered range are missing.

**Scope:**
- When date range active, show: route count, total km, avg distance
- Extend existing `StatsPanel` or inline summary above list

**Effort:** ~1 day

---

## 5. PWA (installable app)

**Problem:** Mobile browser tab is easy to lose; no home-screen icon.

**Scope:**
- `manifest.webmanifest`, icons
- Service worker for static assets (optional offline shell)
- Routes already work offline via IndexedDB; cloud sync when online

**Effort:** ~1–2 days

---

## 6. Keyboard shortcuts help

**Problem:** Draw/edit shortcuts exist but are undiscoverable.

**Scope:**
- `?` opens modal with shortcuts (Esc, Enter, Backspace, Shift+click, etc.)
- Link from map controls hint area

**Effort:** ~half day
