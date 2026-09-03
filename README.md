# Path Tracker

Offline-first веб-приложение для рисования, GPS-записи и импорта маршрутов с визуализацией на карте и 3D-глобусе. Данные хранятся локально в браузере (IndexedDB).

**Стек:** React 19 · TypeScript · Vite · MapLibre GL · Zustand · Dexie · Turf

## Быстрый старт

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

## Документация

Полная документация для разработчиков и AI-агентов — в каталоге [`docs/`](docs/):

| Документ | Описание |
|----------|----------|
| [docs/README.md](docs/README.md) | Индекс документации |
| [docs/agent-guide.md](docs/agent-guide.md) | **Старт для AI-агентов** — карта модулей, инварианты |
| [docs/overview.md](docs/overview.md) | Возможности и стек |
| [docs/architecture.md](docs/architecture.md) | Архитектура и потоки данных |
| [docs/getting-started.md](docs/getting-started.md) | Установка и dev workflow |

Остальные разделы: [data-model](docs/data-model.md) · [state-management](docs/state-management.md) · [map-and-layers](docs/map-and-layers.md) · [drawing-and-gps](docs/drawing-and-gps.md) · [import-export](docs/import-export.md) · [geo-utilities](docs/geo-utilities.md) · [ui-components](docs/ui-components.md)

## Страницы

| URL | Описание |
|-----|----------|
| `/` | 2D-карта, рисование, панель маршрутов |
| `/globe` | 3D-глобус со спутниковыми снимками |

## Структура проекта

```
src/
├── features/   map, draw, routes
├── stores/     routeStore, drawStore (Zustand)
├── db/         IndexedDB (Dexie)
├── lib/geo/    геометрия, импорт, геокодинг
├── types/      RouteFeature (GeoJSON)
└── pages/      MapPage, GlobePage
```
