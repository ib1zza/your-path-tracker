# Firebase: auth и синхронизация маршрутов

Firebase **опционален**. Без переменных `VITE_FIREBASE_*` приложение работает как offline SPA: маршруты только в IndexedDB, кнопка входа скрыта.

С заполненным `.env` источник правды для залогиненного пользователя — **Firestore**. IndexedDB остаётся локальным кэшем и хранилищем GPS-draft.

## Конфигурация

| Файл | Назначение |
|------|------------|
| `.env.example` | Шаблон `VITE_FIREBASE_*` |
| `src/lib/firebase/config.ts` | Чтение env, `initializeApp`, Auth + Firestore |
| `src/lib/firebase/auth.ts` | Google popup, `onAuthStateChanged` |
| `src/lib/firebase/syncRoutes.ts` | Firebase-first load/save/delete |
| `src/lib/firebase/sanitizeForFirestore.ts` | Удаление `undefined` перед записью |
| `src/db/routesFirestore.ts` | Документ `users/{uid}/sync/routes` |
| `src/stores/authStore.ts` | Сессия, sync status, `syncNow` |
| `src/features/auth/AuthButton.tsx` | Sign in / Settings / Sync now |
| `firestore.rules` | Доступ только к своему `uid` |
| `firebase.json` | Firestore + Hosting rewrites на `index.html` |

Все шесть полей обязательны, иначе `isFirebaseConfigured === false`:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Значения — из Firebase Console (Web app) или `firebase apps:sdkconfig`.

## Модель в Firestore

Один документ на пользователя:

```
users/{uid}/sync/routes
```

Поля:

| Поле | Смысл |
|------|--------|
| `routesJson` | JSON-массив `RouteFeature[]` (без `undefined`) |
| `updatedAt` | max `properties.updatedAt` / `createdAt` |
| `routeCount` | число маршрутов |

Чтение/запись: `getDoc` / `setDoc` всего документа. Отдельные CRUD-операции перечитывают документ, меняют массив и пишут целиком.

Legacy: клиент умеет разобрать старые документы с `routeJson` (один маршрут) и сырой GeoJSON Feature. Rules оставляют доступ к `users/{uid}/routes/{routeId}` для старых документов.

## Firebase-first sync

`syncRoutesForUser(uid)` при входе и по **Sync now**:

1. Cloud непустой → `replaceAllRoutes(cloud)` в Dexie, в UI этот снимок
2. Cloud пустой, локально есть маршруты → upload в Firestore, UI = local
3. Оба пустые → пустой список

`loadRoutesForCurrentUser()` (гость или после sign-out):

- есть uid → fetch cloud; если есть данные — заменить Dexie и вернуть cloud, иначе local
- нет uid → только Dexie

После sign-out IndexedDB **не очищается** («Keep local routes on this device»).

## Persistence из routeStore

CRUD больше не ходит в Dexie напрямую. Обёртки в `syncRoutes.ts`:

| Вызов | Гость | Залогинен |
|-------|-------|-----------|
| `persistRoute` | `saveRoute` (Dexie) | Firestore merge + Dexie |
| `persistRoutes` | `saveRoutes` | overlay на cloud snapshot + replace Dexie |
| `replacePersistedRoutes` | `replaceAllRoutes` | одна запись полного массива в Firestore + Dexie |
| `removeRoute` | `deleteRoute` | delete in cloud + Dexie |

`replaceAllRoutes` в Dexie — полная замена таблицы `routes` (нужна для cloud overlay).

## authStore

| Поле | Описание |
|------|----------|
| `user` | Firebase `User` или `null` |
| `isReady` | listener подписан (или Firebase выключен) |
| `isSyncing` / `syncStatus` | прогресс («Loading routes from cloud…») |
| `lastSyncedAt` | ISO время успешного sync |
| `error` | sign-in / sync ошибка |
| `isConfigured` | все `VITE_FIREBASE_*` заданы |

`init()` вызывается из `App.tsx` (cleanup = unsubscribe). Если Firebase не настроен — сразу `loadRoutes()`. Если настроен — `onAuthStateChanged`: user → cloud sync + `applyRoutes`; anonymous → `loadRoutes()`.

`applyRoutes` только обновляет Zustand (без повторной записи в cloud). Используется после sync, чтобы не зациклить persist.

## UI

`AuthButton` в шапке (если configured):

- Sign in with Google (popup)
- статус + last sync time
- Settings → **Sync now**, **Sign out**, **Delete duplicates** (дубликаты доступны и без аккаунта)

## Правила безопасности

`firestore.rules`: read/write только если `request.auth.uid == userId` на путях `users/{userId}/sync/{docId}` и legacy `users/{userId}/routes/{routeId}`.

## Скрипты и деплой

- `scripts/add-auth-domains.mjs` — добавить authorized domains в Identity Toolkit (нужен залогиненный Firebase CLI).
- Hosting в `firebase.json`: `public: dist`, SPA rewrite `**` → `/index.html`.
- Google OAuth redirect URIs включают localhost:5173/4173 и `https://your-path-tracker.vercel.app`.

## Инварианты

- Не вызывать Firebase CRUD из компонентов — только через store → `syncRoutes`.
- Не писать `undefined` в Firestore (sanitize).
- Cloud документ — целиком; гонки при двух вкладках возможны (last write wins).
- GPS draft **не** синхронизируется в cloud, только IndexedDB.
