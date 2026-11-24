# AGENTS.md — frontend/

Действуют общие правила из корневого `AGENTS.md` и `docs/`. Здесь — специфика React/TypeScript.

## Стек и структура

React 19, TypeScript, Vite, Tailwind CSS 4, YouTube IFrame Player API, нативный WebSocket.
Слои: `app` (router/providers), `pages`, `components`, `hooks`, `api` (REST), `realtime`
(протокол, сокет, sync engine), `player` (адаптер YouTube), `lib` (утилиты).

## Правила

- Компоненты и страницы не вызывают `fetch` и `WebSocket` напрямую. Только `api/` и `realtime/`.
- `frontend/src/realtime/**` — зона Realtime. Не редактируй без согласования; интерфейс
  `useRoomRealtime` описан в `docs/WEBSOCKET.md#11-клиентская-реализация`.
- `frontend/src/player/` — твоя зона. Реализуй `PlayerAdapter` строго по интерфейсу из docs.
  Синхронизация не вызывает методы IFrame API напрямую.
- Поля протокола (`room_code`, `position_seconds`, `is_playing`, `updated_at`, `revision` и т.д.)
  не переименовывай. DTO в `api/types.ts` и `realtime/protocol.ts` — зеркало серверных схем.
- Любой программный вызов плеера — под флагом `isApplyingRemote`; события, вызванные применением
  серверного состояния, не отправляются обратно.
- Никакого `dangerouslySetInnerHTML`. Пользовательский текст рендерится как текст.
- Токен хранится в `localStorage` по ключу `wt.access_token.{room_code}`, не логируется и не
  попадает в URL. WS подключается только через одноразовый ticket.
- Состояние комнаты — через `useRoomRealtime`; не дублируй его в глобальном store без причины.
- Ошибки API показывай по `error.code`, а не по `error.message`.
- Не добавляй библиотеки (state manager, UI-kit, axios, socket.io) без согласования.

## UI и доступность

- Tailwind, без inline-стилей и сторонних CSS-фреймворков.
- Обязательные состояния: loading, empty, error, offline/reconnecting, room closed.
- Кнопки смены видео и закрытия комнаты видны только `owner`; серверная проверка всё равно
  обязательна.
- Интерактивные элементы — с `aria-label`, фокусом и клавиатурной доступностью.
- Мобильная вёрстка: чат и участники не ломают плеер на узком экране.

## Проверки

```bash
yarn lint && yarn typecheck && yarn test && yarn build
```

Тесты компонентов — Vitest + React Testing Library, рядом с исходником (`*.test.tsx`).

## Запрещено

- менять `realtime/**` или `PlayerAdapter` без PR и ревью Realtime;
- придумывать поля/события, которых нет в `docs/API.md` и `docs/WEBSOCKET.md`;
- хранить `access_token` в query string, cookies или логах;
- отключать ESLint-правила без комментария и причины;
- коммитить `dist/`, `node_modules/`, `.env`.
