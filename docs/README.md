# Path Tracker — документация

**Path Tracker** (`your-path-tracker`) — веб-приложение для рисования, записи GPS-треков и импорта маршрутов на карте и 3D-глобусе. Локально данные лежат в IndexedDB; при настроенном Firebase залогиненный пользователь синхронизирует маршруты через Firestore.

## Для AI-агентов

Начните с [agent-guide.md](./agent-guide.md) — правила, карта модулей, инварианты.

## Содержание

| Документ | Описание |
|----------|----------|
| [overview.md](./overview.md) | Назначение, стек, возможности |
| [architecture.md](./architecture.md) | Структура проекта, потоки данных, маршрутизация |
| [getting-started.md](./getting-started.md) | Установка, Yarn, скрипты, env |
| [firebase-sync.md](./firebase-sync.md) | Google auth, Firestore, Firebase-first sync |
| [data-model.md](./data-model.md) | GeoJSON-модель, IndexedDB, Firestore-документ |
| [state-management.md](./state-management.md) | Zustand: route, draw, auth, mapUi |
| [map-and-layers.md](./map-and-layers.md) | MapLibre, слои, heatmap, my location |
| [drawing-and-gps.md](./drawing-and-gps.md) | Рисование, GPS, редактирование вершин |
| [import-export.md](./import-export.md) | GPX/KML/TCX/GeoJSON, Apple Health dedup |
| [geo-utilities.md](./geo-utilities.md) | Библиотека `src/lib/geo/*` |
| [ui-components.md](./ui-components.md) | React-компоненты и страницы |
| [agent-guide.md](./agent-guide.md) | Шпаргалка для агентов |

Roadmap (не runtime): [`plans/`](../plans/README.md).

## Ключевые пути

```
src/
├── App.tsx              # Router + authStore.init
├── main.tsx             # Entry, MapLibre worker URL
├── types/route.ts       # RouteFeature
├── db/                  # Dexie + Firestore document helpers
├── stores/              # route, draw, auth, mapUi
├── features/            # map, draw, routes, auth
├── lib/geo/             # геометрия, импорт, геокодинг
├── lib/firebase/        # config, auth, sync
├── lib/map/             # setupMapLibre
├── pages/               # MapPage, GlobePage
└── components/          # Layout
```

## Внешние зависимости (сеть)

- **OpenStreetMap** — тайлы 2D-карты
- **Esri / CARTO** — спутник и подписи на Globe
- **Nominatim** — поиск мест и reverse geocoding (~1.1 с между reverse-запросами)
- **Firebase** (если задан `.env`) — Google Auth, Firestore
