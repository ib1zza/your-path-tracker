# Обзор проекта

## Назначение

Path Tracker помогает пользователю:

1. **Рисовать маршруты** на карте (кликами или freehand)
2. **Записывать GPS-треки** в реальном времени с паузой, autosave и wake lock
3. **Импортировать** маршруты из GPX, KML, TCX, GeoJSON и Apple Health export (ZIP)
4. **Редактировать** геометрию сохранённых маршрутов (вершины, удаление спайков GPS)
5. **Просматривать** маршруты на 2D-карте с heatmap повторных посещений
6. **Исследовать** маршруты на 3D-глобусе со спутниковыми снимками

Все данные остаются в браузере пользователя.

## Технологический стек

| Категория | Технология |
|-----------|------------|
| UI | React 19, TypeScript |
| Сборка | Vite 8 |
| Карта | MapLibre GL + react-map-gl |
| 3D (legacy helpers) | three.js, @react-three/fiber (в `globe.ts`; Globe page использует MapLibre globe projection) |
| Геоданные | GeoJSON, @turf/turf, @tmcw/togeojson |
| Хранение | Dexie (IndexedDB) |
| Состояние | Zustand |
| Роутинг | react-router-dom v7 |
| Линтер | oxlint |
| Архивы | jszip |

## Страницы приложения

| URL | Компонент | Описание |
|-----|-----------|----------|
| `/` | `MapPage` → `MapView` | Основная карта, панель маршрутов, рисование |
| `/globe` | `GlobePage` | 3D-глобус со спутником, группировка по местам |

## Основные пользовательские сценарии

### Создание маршрута

```
DrawToolbar → mode (click | freehand | gps)
  → points накапливаются в drawStore
  → preview layer на карте
  → Finish → modal (имя, заметки) → routeStore.addRoute → IndexedDB
```

### Выбор маршрута (focus mode)

Клик по линии маршрута на карте → `selectRoute(id)` → на карте виден только выбранный маршрут. Клик по пустому месту сбрасывает выбор.

### Импорт Apple Health

ZIP-архив экспорта → фильтр `workout-routes/*.gpx` → парсинг даты из имени файла (`YYYY-MM-DD`) → backfill `createdAt`.

## Ограничения и особенности

- **Нет бэкенда** — синхронизация между устройствами только через export/import файлов
- **Nominatim rate limit** — `ensurePlaceNames` делает паузу 1100 ms между запросами
- **Упрощение геометрии** — маршруты с >400 точек автоматически упрощаются при загрузке (`thinRoutes`)
- **GPS draft** — незавершённая GPS-сессия сохраняется в IndexedDB и предлагается возобновить
- **PWA-ready** — `manifest.webmanifest`, mobile meta tags в `index.html`
