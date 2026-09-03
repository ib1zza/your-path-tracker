# Быстрый старт

## Требования

- Node.js (рекомендуется LTS)
- npm

## Установка и запуск

```bash
npm install
npm run dev      # dev server (Vite), обычно http://localhost:5173
npm run build    # tsc -b && vite build
npm run preview  # preview production build
npm run lint     # oxlint
```

## Конфигурация

| Файл | Назначение |
|------|------------|
| `vite.config.ts` | React plugin, optimizeDeps для maplibre-gl |
| `tsconfig.json` | Project references |
| `tsconfig.app.json` | Настройки TS для src/ |
| `tsconfig.node.json` | TS для vite.config |
| `.oxlintrc.json` | Правила линтера |

Секретов и `.env` в проекте нет — все tile URLs и Nominatim захардкожены.

## MapLibre worker

`src/lib/map/setupMapLibre.ts` регистрирует worker через Vite `?url` import. Импортируется в `main.tsx` до рендера приложения.

## Локальное хранилище

Данные в IndexedDB базе `PathTrackerDB`:

- DevTools → Application → IndexedDB → PathTrackerDB

Для сброса данных удалите базу или очистите routes через UI (delete all routes individually).

## localStorage

| Ключ | Значение |
|------|----------|
| `path-tracker-map-style` | `osm` \| `dark` \| `topo` |

## PWA / Mobile

- `public/manifest.webmanifest` — web app manifest
- `index.html` — viewport, theme-color, apple-mobile-web-app meta

GPS и wake lock работают лучше на HTTPS или localhost; на мобильных нужно разрешение геолокации.

## Сборка для production

```bash
npm run build
# output: dist/
```

Статический хостинг (Netlify, Vercel, GitHub Pages) — достаточно отдавать `dist/`. SPA fallback на `index.html` для client-side routing (`/globe`).

## Тестирование вручную

Чеклист после изменений:

1. Загрузка приложения, пустой список маршрутов
2. Click draw → 2+ точки → Save → маршрут в панели и на карте
3. Select route → focus mode → click empty → deselect
4. Import GPX / GeoJSON
5. GPS mode (если доступно) → pause → resume draft prompt
6. Edit geometry → drag vertex → Save edits
7. Heatmap toggle
8. Globe page → place pins, fly to route
9. Export all / single route

Автотестов в репозитории нет.
