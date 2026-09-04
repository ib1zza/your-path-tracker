# Path Tracker

Веб-приложение для рисования, GPS-записи и импорта маршрутов с визуализацией на OSM-карте и 3D-глобусе. Локально — IndexedDB; с Firebase — синхронизация маршрутов через Google-аккаунт.

**Стек:** React 19 · TypeScript · Vite · MapLibre GL · Zustand · Dexie · Firebase · Turf · Yarn 4

## Быстрый старт

```bash
yarn install
yarn dev         # http://localhost:5173
yarn build
yarn lint
yarn format
make check       # lint + format-check + build
```

Опционально скопируйте `.env.example` → `.env` для входа и cloud sync. Подробности: [docs/getting-started.md](docs/getting-started.md), [docs/firebase-sync.md](docs/firebase-sync.md).

## Документация

Полная документация — в [`docs/`](docs/):

| Документ | Описание |
|----------|----------|
| [docs/README.md](docs/README.md) | Индекс |
| [docs/agent-guide.md](docs/agent-guide.md) | **Старт для AI-агентов** |
| [docs/overview.md](docs/overview.md) | Возможности и стек |
| [docs/architecture.md](docs/architecture.md) | Архитектура |
| [docs/getting-started.md](docs/getting-started.md) | Установка и workflow |
| [docs/firebase-sync.md](docs/firebase-sync.md) | Auth и Firestore |

Остальные разделы: [data-model](docs/data-model.md) · [state-management](docs/state-management.md) · [map-and-layers](docs/map-and-layers.md) · [drawing-and-gps](docs/drawing-and-gps.md) · [import-export](docs/import-export.md) · [geo-utilities](docs/geo-utilities.md) · [ui-components](docs/ui-components.md)

## Страницы

| URL | Описание |
|-----|----------|
| `/` | 2D OSM-карта, рисование, панель маршрутов |
| `/globe` | 3D-глобус со спутниковыми снимками |

## Структура проекта

```
src/
├── features/    map, draw, routes, auth
├── stores/      routeStore, drawStore, authStore, mapUiStore
├── db/          Dexie + Firestore helpers
├── lib/geo/     геометрия, импорт, геокодинг
├── lib/firebase auth, sync
├── types/       RouteFeature
└── pages/       MapPage, GlobePage
```
