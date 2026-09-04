# Быстрый старт

## Требования

- Node.js LTS (рекомендуется 20+)
- Yarn 4 через Corepack (`packageManager`: `yarn@4.18.0`)
- GNU Make — опционально (`make check` и остальные цели)

На Windows `corepack enable` может требовать права администратора. Если Yarn 4 уже в PATH, достаточно `yarn install`.

Linker: `node-modules` (`.yarnrc.yml`), не PnP.

## Установка и запуск

```bash
yarn install
yarn dev           # Vite, обычно http://localhost:5173
yarn build         # tsc -b && vite build
yarn preview       # preview production build
yarn lint          # oxlint
yarn lint:fix      # oxlint --fix
yarn format        # Prettier --write
yarn format:check  # Prettier --check
yarn typecheck     # tsc -b
yarn check         # lint + format-check + build
make check         # то же через Makefile
```

## Конфигурация

| Файл | Назначение |
|------|------------|
| `vite.config.ts` | React plugin, копирование MapLibre worker в `/maplibre/` |
| `tsconfig.json` | Project references |
| `tsconfig.app.json` | TS для `src/` |
| `tsconfig.node.json` | TS для `vite.config` |
| `.oxlintrc.json` | oxlint (React 19: `react-in-jsx-scope` off) |
| `.prettierrc.json` | Кодстайл |
| `.editorconfig` | Отступы, LF |
| `.yarnrc.yml` | Yarn 4, `nodeLinker: node-modules` |
| `Makefile` | Обёртка над yarn-скриптами |
| `.env` | Firebase Web config (не коммитится) |
| `.env.example` | Шаблон env |

## Firebase (опционально)

Без `.env` приложение полностью локальное. Для Google-входа и cloud sync скопируйте `.env.example` → `.env` и заполните `VITE_FIREBASE_*` (см. [firebase-sync.md](./firebase-sync.md)).

После смены env перезапустите `yarn dev`.

## MapLibre worker

`src/lib/map/setupMapLibre.ts` задаёт worker URL:

```
${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.mjs
```

Плагин в `vite.config.ts` отдаёт `maplibre-gl-worker.mjs` и `maplibre-gl-shared.mjs` в dev и копирует их в `dist/maplibre/` при `yarn build`. Импорт setup — в `main.tsx` до рендера.

## Локальное хранилище

IndexedDB база `PathTrackerDB`:

- DevTools → Application → IndexedDB → PathTrackerDB
- Таблица `routes` — кэш маршрутов (для гостя это единственное хранилище)
- Таблица `gpsDraft` — незавершённая GPS-сессия

Сброс локальных маршрутов: удалить базу или удалять маршруты в UI. Cloud при залогиненном аккаунте при следующем sync снова заполнит Dexie, если документ в Firestore непустой.

localStorage для стиля карты **больше не используется** (2D-карта всегда OSM).

## PWA / Mobile

- `public/manifest.webmanifest`
- `index.html` — viewport, theme-color, apple-mobile-web-app meta

GPS, wake lock и Google popup лучше работают на HTTPS или localhost.

## Сборка и хостинг

```bash
yarn build
# output: dist/
```

SPA fallback на `index.html` нужен для `/globe`. В `firebase.json` hosting это уже настроено. Подходит любой static host (Firebase Hosting, Vercel, Netlify).

## Кодстайл

- Prettier: `semi`, `singleQuote`, `trailingComma: all`, `printWidth: 100`, `endOfLine: lf`
- oxlint: категории correctness/suspicious; часть React-правил ослаблена под существующие эффекты
- В VS Code: `.vscode/extensions.json` и `settings.json` (format on save)

## Тестирование вручную

Чеклист после изменений:

1. Загрузка без `.env`: пустой список, рисование, импорт
2. Click draw → 2+ точки → Save → маршрут в панели и на карте
3. Search / Show all / цвет маршрута / My location
4. Select route → focus mode → click empty → deselect
5. Import GPX / GeoJSON / Apple Health (dedup по времени старта)
6. GPS → pause → resume draft prompt
7. Edit geometry → drag vertex → Save edits
8. Heatmap toggle
9. Globe → place pins, fly to route
10. С `.env`: Sign in → sync → правка маршрута на другом устройстве / Sync now
11. Sign out: локальные маршруты остаются
12. Export all / single route

Автотестов в репозитории нет.
