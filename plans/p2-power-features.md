# P2 — Power features

For users with large libraries and advanced editing needs.

## 1. Merge routes

**Problem:** Two segments of the same walk imported separately.

**Scope:**
- Select 2+ routes → «Merge»
- Concatenate coordinates (option: sort by `createdAt` or pick order)
- New route or overwrite first; delete sources optional

**Effort:** ~2–3 days (edge cases: gaps, duplicate points)

---

## 2. Split route at point

**Problem:** One GPX contains two activities; need to split.

**Scope:**
- In edit mode: «Split here» on selected vertex
- Creates two routes with derived names `- part 1` / `- part 2`

**Effort:** ~2 days

---

## 3. Export map as image

**Problem:** Sharing a pretty map screenshot for social / reports.

**Scope:**
- «Export PNG» captures current map view + visible routes
- Use MapLibre `map.getCanvas().toDataURL()` or html2canvas fallback

**Effort:** ~1–2 days (retina, attribution overlay)

---

## 4. Compare periods

**Problem:** «Am I walking more this month?»

**Scope:**
- Stats: this month vs previous month (distance, count)
- Simple bar or delta badges in stats panel

**Effort:** ~1–2 days

---

## 5. Offline queue for cloud writes

**Problem:** Edits while offline only hit IndexedDB; risk of drift if cloud-first.

**Scope:**
- When logged in but offline: queue mutations
- Flush queue on reconnect before next read
- UI indicator: «Pending sync (N changes)»

**Effort:** ~3–5 days

---

## 6. Route folders / collections

**Problem:** Flat list does not scale past ~100 routes.

**Scope:**
- Optional folder field or virtual collections (e.g. by year, tag)
- Collapsible groups beyond current month/year

**Effort:** ~2–3 days
