# Структура проекта

Документ фиксирует целевую структуру репозитория, назначение директорий и зоны ответственности.
Структура рассчитана на параллельную работу трёх разработчиков: пересечения файлов сведены к
минимуму, а общие контракты вынесены в отдельный список (раздел 5).

## 1. Верхний уровень

```text
WatchTogether/
├── .github/
│   └── workflows/
│       └── ci.yml                 # CI: frontend lint/typecheck/build + backend lint/tests
├── backend/                       # Python + FastAPI (разработчики №2 и №3)
├── frontend/                      # React + TypeScript + Tailwind (разработчики №1 и №3)
├── infra/                         # Docker/nginx-конфиги (владелец: разработчик №2)
│   └── docker/
│       └── nginx.conf             # раздача собранного SPA и проксирование /api
├── docs/                          # эта документация; общая зона
├── .editorconfig
├── .env.example                   # шаблон переменных окружения (без секретов)
├── .gitignore
├── .nvmrc                         # Node 22
├── .prettierrc.json
├── .prettierignore
├── AGENTS.md                      # общие правила для AI-агентов
├── README.md                      # краткое описание и быстрый старт
└── docker-compose.yml             # db + backend + frontend для локального стека
```

`docs/` — единственный источник истины по контрактам. Каталоги `infra/` и `docker-compose.yml`
появятся при первом инфраструктурном PR; до этого backend и frontend запускаются локально, а
PostgreSQL — через контейнер.

## 2. Backend

```text
backend/
├── AGENTS.md                          # правила для AI-агента в backend/
├── Dockerfile                         # python:3.12-slim + uvicorn --workers 1
├── alembic.ini
├── alembic/
│   ├── env.py                         # async-режим, импорт metadata всех моделей
│   ├── script.py.mako
│   └── versions/                      # миграции; единственный head
├── pyproject.toml                     # зависимости, ruff, pytest, mypy
├── app/
│   ├── __init__.py
│   ├── main.py                        # create_app, middleware, роутеры, lifespan
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                    # get_current_principal, owner guard, session
│   │   ├── errors.py                  # exception handlers → единый error envelope
│   │   ├── router.py                  # сборка /api/v1
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py              # GET /health
│   │       ├── rooms.py               # create/get/join/leave/close/ws-ticket
│   │       └── messages.py            # GET /rooms/{room_code}/messages
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                  # pydantic-settings, все лимиты и TTL
│   │   ├── clock.py                   # Clock protocol + SystemClock (для тестов)
│   │   ├── db.py                      # engine, async_sessionmaker, Base
│   │   ├── errors.py                  # AppError и доменные исключения
│   │   ├── events.py                  # порт RoomEventPublisher (REST → WS)
│   │   ├── logging.py                 # структурные логи, request_id
│   │   ├── rate_limit.py              # in-memory token bucket
│   │   ├── security.py                # токены, хеши, JWT ws-ticket, room code
│   │   ├── uow.py                     # UnitOfWork: транзакция и репозитории
│   │   └── youtube.py                 # чистый парсер/валидатор YouTube-ссылок
│   ├── rooms/
│   │   ├── __init__.py
│   │   ├── models.py                  # Room
│   │   ├── repository.py
│   │   ├── schemas.py                 # Room DTO
│   │   └── service.py                 # create/get/close/ensure_active
│   ├── participants/
│   │   ├── __init__.py
│   │   ├── models.py                  # Participant
│   │   ├── repository.py
│   │   ├── schemas.py                 # Participant DTO, Principal
│   │   └── service.py                 # join/leave/auth/resolve token
│   ├── chat/
│   │   ├── __init__.py
│   │   ├── models.py                  # Message
│   │   ├── repository.py
│   │   ├── schemas.py                 # Message DTO
│   │   └── service.py                 # send/history/validate
│   ├── playback/
│   │   ├── __init__.py
│   │   ├── models.py                  # PlaybackStateRow
│   │   ├── repository.py
│   │   ├── schemas.py                 # PlaybackState DTO — общий контракт
│   │   └── service.py                 # command/current_position/change_video
│   ├── use_cases/
│   │   ├── __init__.py
│   │   └── create_room.py             # комната + владелец + playback в одной транзакции
│   └── websocket/
│       ├── AGENTS.md                  # правила для AI-агента в websocket/
│       ├── __init__.py
│       ├── endpoint.py                # /ws/rooms/{room_code}: accept, loop, close
│       ├── manager.py                 # ConnectionManager, broadcast, locks
│       ├── publisher.py               # реализация порта core.events для REST-событий
│       ├── presence.py                # online/offline, grace-таймеры, heartbeat
│       ├── protocol.py                # типы входящих/исходящих событий, envelope
│       ├── errors.py                  # WsError, mapping доменных ошибок
│       └── handlers/
│           ├── __init__.py
│           ├── system.py              # ping/pong, room.sync.request
│           ├── playback.py            # playback.command, sync.request
│           ├── video.py               # video.change
│           ├── chat.py                # chat.send
│           └── room.py                # room.closed (исходящее), закрытие сокетов
├── tests/
│   ├── conftest.py                    # общие фикстуры: app, client, db, фабрики
│   ├── unit/
│   │   ├── test_security.py
│   │   ├── test_youtube_url.py
│   │   ├── test_playback_math.py
│   │   ├── test_rate_limit.py
│   │   └── test_room_codes.py
│   ├── integration/
│   │   ├── test_rooms_api.py
│   │   ├── test_participants_api.py
│   │   ├── test_messages_api.py
│   │   ├── test_ws_ticket_api.py
│   │   └── test_migrations.py
│   └── realtime/
│       ├── test_connection.py
│       ├── test_playback_sync.py
│       ├── test_video_change.py
│       ├── test_chat_ws.py
│       ├── test_presence.py
│       └── test_reconnect.py
```

### Правила backend

- Один модуль = папка с `models.py`, `repository.py`, `schemas.py`, `service.py`. Роутеры живут
  только в `api/routes`.
- SQL — только в `repository.py` своего модуля. `service.py` не пишет запросы.
- `models.py` импортируются в `alembic/env.py` централизованно; новый модуль обязан добавить
  импорт своей модели, иначе миграция не увидит таблицу.
- Все настройки и лимиты читаются из `core/config.py`, магических чисел в коде нет.
- Время берётся из `Clock`, а не из `datetime.utcnow()` напрямую — это нужно для детерминированных
  тестов playback.
- Ошибки домена — подклассы `AppError` с `code`; HTTP и WS маппят их в единый формат.
- WS-handler не содержит SQL и не меняет состояние напрямую: только сервис + broadcast.

## 3. Frontend

```text
frontend/
├── AGENTS.md                          # правила для AI-агента в frontend/
├── Dockerfile                         # build + nginx
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts                     # alias @/, proxy /api → backend в dev
├── eslint.config.js
├── public/
└── src/
    ├── main.tsx
    ├── vite-env.d.ts
    ├── app/
    │   ├── App.tsx
    │   ├── router.tsx                 # /, /r/:roomCode, *
    │   └── providers.tsx              # RoomSessionProvider, ToastProvider
    ├── pages/
    │   ├── HomePage.tsx               # создать комнату / войти по коду
    │   ├── RoomPage.tsx               # gate входа + комната
    │   └── NotFoundPage.tsx
    ├── components/
    │   ├── ui/                        # Button, Input, Dialog, Spinner, Badge
    │   ├── layout/                    # AppShell, Header, Footer
    │   ├── room/                      # RoomHeader, VideoStage, JoinRoomForm, ConnectionBanner,
    │   │                              # RoomClosedNotice, OwnerControls
    │   ├── chat/                      # ChatPanel, MessageList, MessageItem, MessageInput
    │   └── participants/              # ParticipantsPanel, ParticipantItem
    ├── hooks/
    │   ├── useRoomSession.ts          # REST-сессия: join/get/leave/close
    │   ├── useAutoScroll.ts
    │   └── useToast.ts
    ├── api/
    │   ├── client.ts                  # fetch + error envelope + Bearer
    │   ├── rooms.ts                   # типизированные вызовы REST
    │   └── types.ts                   # DTO REST (snake_case, зеркало backend)
    ├── realtime/                      # зона разработчика №3
    │   ├── protocol.ts                # типы WS-событий (snake_case)
    │   ├── socket.ts                  # connect, ticket, backoff, dispatch
    │   ├── useRoomRealtime.ts         # публичный хук комнаты
    │   ├── syncEngine.ts              # drift correction, revision
    │   └── __tests__/
    │       ├── syncEngine.test.ts
    │       └── socket.test.ts
    ├── player/                        # зона разработчика №1
    │   ├── YouTubePlayer.tsx          # компонент-обёртка IFrame API
    │   ├── YouTubePlayerAdapter.ts    # реализация PlayerAdapter
    │   └── types.ts                   # PlayerAdapter, PlayerStatus
    ├── lib/
    │   ├── youtube.ts                 # извлечение/валидация video_id
    │   ├── storage.ts                 # access_token по room_code
    │   └── format.ts                  # время, даты, инициалы
    ├── test/
    │   └── setup.ts                   # Vitest setup (jest-dom, mocks)
    └── styles/
        └── index.css                  # Tailwind + базовые стили
```

Тесты компонентов лежат рядом с исходником (`Component.test.tsx`), общий setup — 
`src/test/setup.ts`. E2E-тесты в MVP не обязательны; при добавлении — `frontend/e2e/`.

### Правила frontend

- DTO в `api/types.ts` и `realtime/protocol.ts` повторяют серверные имена **без переименования**
  (`room_code`, `position_seconds`). Внутренние функции могут быть на camelCase, но поля протокола —
  нет.
- Страницы не вызывают `fetch` и `WebSocket` напрямую: только через `api/` и `realtime/`.
- Компоненты не знают о структуре сокета. Всё, что нужно UI, отдаёт `useRoomRealtime`.
- `YouTubePlayerAdapter` — единственное место работы с IFrame API. Синхронизация не вызывает
  методы игрока напрямую.
- Любой программный вызов плеера оборачивается флагом `isApplyingRemote`, чтобы события плеера не
  отправлялись обратно на сервер (защита от петель).
- Секреты и токены не логируются и не попадают в URL.

## 4. Инфраструктура

```text
infra/
└── docker/
    ├── nginx.conf                     # SPA fallback, proxy /api и /ws, security headers
    └── entrypoint.sh                  # при необходимости

docker-compose.yml                     # db (postgres:16), backend, frontend
```

- `db`: volume `pgdata`, healthcheck `pg_isready`.
- `backend`: сборка `backend/Dockerfile`, `--workers 1`, зависит от `db`.
- `frontend`: dev-режим Vite либо production-сборка через nginx.

## 5. Общие файлы и контракты

Эти файлы меняются только по процедуре согласования из
[TEAM_WORKFLOW.md](./TEAM_WORKFLOW.md#5-изменение-общих-контрактов):

| Файл | Владелец | Кто обязан одобрить изменение |
| --- | --- | --- |
| `docs/API.md` | Backend | Frontend + Realtime |
| `docs/WEBSOCKET.md` | Realtime | Frontend + Backend |
| `docs/DATABASE.md` | Backend | Realtime |
| `docs/ARCHITECTURE.md` | все | хотя бы один другой участник |
| `docs/PROJECT_STRUCTURE.md` | все | хотя бы один другой участник |
| `backend/app/playback/schemas.py` | Realtime | Backend |
| `backend/app/rooms/schemas.py` | Backend | Realtime |
| `backend/app/participants/schemas.py` | Backend | Realtime |
| `backend/app/chat/schemas.py` | Backend | Frontend |
| `backend/app/core/security.py` | Backend | Realtime |
| `backend/app/core/events.py` (`RoomEventPublisher`) | Backend | Realtime |
| `backend/app/websocket/publisher.py` | Realtime | Backend |
| `backend/app/core/config.py` | Backend | все (общие лимиты) |
| `backend/tests/conftest.py` | Backend | Realtime |
| `frontend/src/api/types.ts` | Frontend | Backend |
| `frontend/src/realtime/protocol.ts` | Realtime | Frontend |
| `frontend/src/player/types.ts` (`PlayerAdapter`) | Frontend | Realtime |
| `docker-compose.yml`, `infra/**`, `.github/workflows/**` | Backend | любой участник |
| `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, `backend/app/websocket/AGENTS.md` | все | хотя бы один другой участник |

## 6. Кому что принадлежит

| Разработчик | Директории и файлы |
| --- | --- |
| **№1 Frontend** | `frontend/src/app`, `pages`, `components`, `hooks`, `api`, `lib`, `styles`, `player`; `frontend/index.html`, `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `frontend/public`; `frontend/src/**/*.test.tsx` для UI |
| **№2 Backend** | `backend/app/api`, `core`, `rooms`, `participants`, `chat`, `use_cases`; `backend/alembic/**`, `alembic.ini`, `pyproject.toml`; `backend/tests/unit` (кроме playback), `backend/tests/integration`, `backend/tests/conftest.py`; `infra/**`, `docker-compose.yml`, `.github/workflows/**`; `backend/Dockerfile`, `frontend/Dockerfile` |
| **№3 Realtime** | `backend/app/websocket/**`, `backend/app/playback/**`; `backend/tests/realtime/**`, `backend/tests/unit/test_playback_math.py`; `frontend/src/realtime/**`; `frontend/src/realtime/__tests__/**` |

Общие для всех: `docs/**`, корневые конфиги (`.editorconfig`, `.gitignore`, `.env.example`),
`AGENTS.md` в своих зонах.

## 7. Правила размещения нового кода

| Что добавляется | Куда |
| --- | --- |
| Новый REST endpoint | `backend/app/api/routes/*.py` + метод в сервисе; контракт — в `docs/API.md` |
| Новое WS-событие | `backend/app/websocket/protocol.py`, handler в `handlers/`, контракт — в `docs/WEBSOCKET.md`; тип на клиенте — `frontend/src/realtime/protocol.ts` |
| Новая таблица/колонка | `models.py` модуля → миграция в `alembic/versions` → `docs/DATABASE.md` |
| Новая бизнес-операция | `service.py` модуля; если затрагивает 2+ модуля — `use_cases/` |
| Новый UI-экран | `frontend/src/pages` + маршрут в `app/router.tsx`; переиспользуемые части — `components/` |
| Новый хук синхронизации | `frontend/src/realtime/` |
| Работа с YouTube IFrame API | только `frontend/src/player/` |
| Общая настройка/лимит | `backend/app/core/config.py` + `docs/DEVELOPMENT.md` |

## 8. Соглашения об именовании

- Backend: пакеты и модули — `snake_case`, классы — `PascalCase`, функции — `snake_case`.
- Frontend: компоненты и хуки — `PascalCase`/`useCamelCase`, файлы компонентов — `PascalCase.tsx`.
- REST и WS: JSON-поля — `snake_case`; события WS — `домен.действие` (`playback.state`,
  `chat.send`); коды ошибок — `snake_case`.
- Ветки Git: `feat/<zone>/<short-name>`, где `zone` ∈ `frontend`, `backend`, `realtime`, `docs`,
  `infra`.
- Таблицы БД — множественное число (`rooms`, `participants`, `messages`), колонки — `snake_case`.
- Миграции: `alembic revision -m "add playback revision"`; имя файла не переименовывается после
  merge.
