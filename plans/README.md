# Path Tracker — Product Plans

Roadmap ideas grouped by priority. Each file describes scope, user value, and rough effort.

| Priority | File | Focus |
|----------|------|--------|
| P0 | [p0-quick-wins.md](./p0-quick-wins.md) | High impact, low effort — do first |
| P1 | [p1-core-ux.md](./p1-core-ux.md) | Medium effort, strong daily-use value |
| P2 | [p2-power-features.md](./p2-power-features.md) | Larger features for power users |
| P3 | [p3-future.md](./p3-future.md) | Nice-to-have / needs external services |

## Data model note

When signed in, **Firebase Firestore is the source of truth**. IndexedDB (Dexie) is a local cache mirrored from cloud on sync. Local-only data is uploaded to Firebase only when the cloud account has no routes yet (first login bootstrap).

## Current baseline (already shipped)

- Draw routes: click, freehand, GPS
- Edit geometry, clean GPS spikes
- Import GPX / GeoJSON / KML / TCX / Apple Health ZIP (Health dedup by start time)
- Export routes
- List with search, month/year grouping, date filters, Show all
- Route color picker
- My location + follow (independent of GPS recording)
- Heatmap and Globe view
- Stats panel (distance, revisits)
- Place search and geocoded place names
- Google Sign-In + Firestore sync + Sync now
- Delete duplicates (start time or name+distance)
- Yarn 4, Prettier, oxlint, Makefile (`make check`)
