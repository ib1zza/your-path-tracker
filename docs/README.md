# Path Tracker — документация

**Path Tracker** (`your-path-tracker`) — клиентское веб-приложение для рисования, записи GPS-треков и импорта маршрутов с визуализацией на карте и 3D-глобусе. Данные хранятся локально в браузере (IndexedDB), серверной части нет.

## Для AI-агентов

Начните с [agent-guide.md](./agent-guide.md) — там краткие правила, карта модулей и типичные задачи.

## Содержание

| Документ | Описание |
|----------|----------|
| [overview.md](./overview.md) | Назначение, стек, возможности |
| [architecture.md](./architecture.md) | Структура проекта, потоки данных, маршрутизация |
| [getting-started.md](./getting-started.md) | Установка, скрипты, окружение |
| [data-model.md](./data-model.md) | GeoJSON-модель, IndexedDB, типы |
| [state-management.md](./state-management.md) | Zustand-сторы `routeStore` и `drawStore` |
| [map-and-layers.md](./map-and-layers.md) | MapLibre, слои, heatmap, стили карты |
| [drawing-and-gps.md](./drawing-and-gps.md) | Режимы рисования, GPS, редактирование вершин |
| [import-export.md](./import-export.md) | Форматы GPX/KML/TCX/GeoJSON, Apple Health |
| [geo-utilities.md](./geo-utilities.md) | Библиотека `src/lib/geo/*` |
| [ui-components.md](./ui-components.md) | React-компоненты и страницы |
| [agent-guide.md](./agent-guide.md) | Шпаргалка для агентов |

## Ключевые пути

```
src/
├── App.tsx              # Router + загрузка маршрутов при старте
├── main.tsx             # Entry point, инициализация MapLibre worker
├── types/route.ts       # RouteFeature, цвета, форматирование
├── db/routesDb.ts       # Dexie / IndexedDB
├── stores/              # Zustand
├── features/            # map, draw, routes
├── lib/geo/             # Геометрия, импорт, геокодинг
├── lib/map/             # setupMapLibre
├── pages/               # MapPage, GlobePage
└── components/          # Layout
```

## Внешние зависимости (сеть)

Приложение обращается к публичным API без ключей:

- **OpenStreetMap** — тайлы карты
- **CARTO / OpenTopoMap / Esri** — альтернативные стили / спутник на Globe
- **Nominatim** (OpenStreetMap) — поиск мест и reverse geocoding (с rate limit ~1.1 с между запросами)
