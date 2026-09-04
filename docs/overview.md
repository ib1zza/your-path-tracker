# Обзор проекта

## Назначение

Path Tracker помогает пользователю:

1. **Рисовать маршруты** на карте (кликами или freehand)
2. **Записывать GPS-треки** в реальном времени с паузой, autosave и wake lock
3. **Импортировать** маршруты из GPX, KML, TCX, GeoJSON и Apple Health export (ZIP), с дедупликацией Health по времени старта
4. **Редактировать** геометрию, цвет, имя и заметки сохранённых маршрутов
5. **Искать** маршруты по имени/месту и вписывать все видимые треки в карту
6. **Просматривать** маршруты на 2D-карте (OSM) с heatmap и маркером своей позиции
7. **Исследовать** маршруты на 3D-глобусе со спутниковыми снимками
8. **Синхронизировать** маршруты между устройствами через Google-аккаунт (опциональный Firebase)

Без Firebase данные остаются только в браузере. С Firebase залогиненный пользователь получает Firestore как основной источник маршрутов; IndexedDB — кэш и GPS-draft.

## Технологический стек

| Категория | Технология |
|-----------|------------|
| UI | React 19, TypeScript |
| Сборка | Vite 8 |
| Карта | MapLibre GL + react-map-gl |
| 3D (legacy helpers) | three.js, @react-three/fiber (в `globe.ts`; Globe page — MapLibre globe projection) |
| Геоданные | GeoJSON, @turf/turf, @tmcw/togeojson |
| Локальное хранение | Dexie (IndexedDB) |
| Cloud | Firebase Auth (Google) + Firestore |
| Состояние | Zustand (`routeStore`, `drawStore`, `authStore`, `mapUiStore`) |
| Роутинг | react-router-dom v7 |
| Линтер / формат | oxlint, Prettier |
| Пакетный менеджер | Yarn 4 |
| Архивы | jszip |

## Страницы приложения

| URL | Компонент | Описание |
|-----|-----------|----------|
| `/` | `MapPage` → `MapView` | OSM-карта, панель маршрутов, рисование |
| `/globe` | `GlobePage` | 3D-глобус со спутником, группировка по местам |

## Основные пользовательские сценарии

### Создание маршрута

```
DrawToolbar → mode (click | freehand | gps)
  → points в drawStore
  → preview layer
  → Finish → modal → routeStore.addRoute → persistRoute (Dexie ± Firestore)
```

### Выбор маршрута (focus mode)

Клик по линии → `selectRoute(id)` → на карте только выбранный маршрут. Клик по пустому месту сбрасывает выбор.

### Синхронизация

Sign in with Google → `syncRoutesForUser`: cloud побеждает, если непустой; иначе upload локальных маршрутов. Settings → Sync now повторяет тот же алгоритм.

### Импорт Apple Health

ZIP → `workout-routes/*.gpx` → дата/время из имени → при совпадении start time (до минуты) маршрут пропускается или перезаписывается (диалог overwrite). Settings → Delete duplicates убирает уже сохранённые дубли.

## Ограничения и особенности

- **Firebase опционален** — без env нет входа и cloud; без аккаунта CRUD только в Dexie
- **Nominatim rate limit** — `ensurePlaceNames` пауза 1100 ms
- **Упрощение геометрии** — >400 точек → `thinRoutes` при загрузке
- **GPS draft** — только IndexedDB, не в cloud
- **2D basemap** — только OSM (переключатель dark/topo снят)
- **PWA-ready** — `manifest.webmanifest`, mobile meta в `index.html`
