# Разработка и запуск

Документ описывает локальное окружение, запуск сервисов, миграции и проверки. Все команды
выполняются из корня репозитория, если не указано иное.

## 1. Требования к окружению

| Инструмент | Версия | Проверка |
| --- | --- | --- |
| Python | 3.12+ | `python --version` |
| Node.js | 22 LTS (см. `.nvmrc`) | `node --version` |
| Yarn | 4 (Corepack) | `corepack enable && yarn --version` |
| Docker + Docker Compose | актуальные | `docker compose version` |
| Git | 2.40+ | `git --version` |

Windows: команды ниже работают в Git Bash/PowerShell; Python-виртуальное окружение —
`.venv\Scripts\activate` (PowerShell) или `source .venv/Scripts/activate` (Git Bash).

## 2. Порты

| Сервис | Порт | URL |
| --- | --- | --- |
| Frontend (Vite dev) | 5173 | `http://localhost:5173` |
| Backend (uvicorn) | 8000 | `http://localhost:8000`, WS `ws://localhost:8000` |
| PostgreSQL | 5432 | `localhost:5432` |

## 3. Переменные окружения

Секреты не коммитятся. Шаблон — `.env.example` в корне; локальные значения — `.env` (в
`.gitignore`).

### Backend

| Переменная | Пример | Обяз. | Назначение |
| --- | --- | --- | --- |
| `APP_ENV` | `development` | да | `development` / `production` / `test` |
| `APP_SECRET_KEY` | `change-me-32-bytes-minimum` | да | Подпись WS-ticket |
| `DATABASE_URL` | `postgresql+asyncpg://watchtogether:watchtogether@localhost:5432/watchtogether` | да | Основная БД |
| `TEST_DATABASE_URL` | `postgresql+asyncpg://watchtogether:watchtogether@localhost:5432/watchtogether_test` | для тестов | Тестовая БД |
| `CORS_ORIGINS` | `http://localhost:5173` | да | Разрешённые origins (через запятую) |
| `ROOM_MAX_PARTICIPANTS` | `10` | нет | Лимит участников (2..10) |
| `WS_TICKET_TTL_SECONDS` | `60` | нет | TTL WS-ticket |
| `PRESENCE_GRACE_SECONDS` | `15` | нет | Задержка перед `participant.left` |
| `WS_HEARTBEAT_INTERVAL_SECONDS` | `25` | нет | Период server ping |
| `WS_HEARTBEAT_TIMEOUT_SECONDS` | `10` | нет | Ожидание pong |
| `PLAYBACK_POSITION_TOLERANCE_SECONDS` | `3.0` | нет | Допуск позиции для play/pause |
| `TRUST_PROXY_HEADERS` | `false` | нет | Доверять `X-Forwarded-For` (только за известным прокси) |
| `LOG_LEVEL` | `INFO` | нет | Уровень логов |

Лимиты (значения по умолчанию) задаются в `app/core/config.py` и описаны в
[SECURITY.md](./SECURITY.md#7-защита-от-злоупотреблений). Менять их в коде нельзя — только через
конфиг.

### Frontend

| Переменная | Пример | Назначение |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8000/api/v1` | База REST |
| `VITE_WS_URL` | `ws://localhost:8000/api/v1/ws` | База WebSocket |

> В текущем `.env.example` указан `VITE_API_URL=http://localhost:8080`. При первом
> инфраструктурном PR значение приводится к `8000` (или backend запускается на 8080 — но
> стандартом команды выбран 8000). Это единственное известное расхождение репозитория.

## 4. PostgreSQL через Docker Compose

```bash
docker compose up -d db
docker compose ps
docker compose logs -f db
```

Сервис `db`:

- образ `postgres:16-alpine`;
- БД `watchtogether`, пользователь/пароль `watchtogether`;
- volume `pgdata` для сохранения данных;
- healthcheck `pg_isready -U watchtogether`.

Создание тестовой БД (один раз):

```bash
docker compose exec db psql -U watchtogether -d watchtogether \
  -c 'CREATE DATABASE watchtogether_test;'
```

Полный стек (db + backend + frontend):

```bash
docker compose up --build
```

Для повседневной разработки рекомендуется держать в Docker только `db`, а backend и frontend
запускать локально — быстрее hot reload.

## 5. Backend

### Установка

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash
# .venv\Scripts\Activate.ps1       # Windows PowerShell
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

`pyproject.toml` содержит зависимости приложения и dev-инструменты (pytest, httpx, ruff, mypy).
Файл `requirements.txt` не используется — единственный источник зависимостей `pyproject.toml`.

### Запуск

```bash
cd backend
cp ../.env.example .env             # один раз, затем заполнить значения
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- `--workers 1` обязателен для MVP: presence и rate limit живут в памяти процесса. В production
  это задаётся в Dockerfile/команде запуска.
- Swagger: `http://localhost:8000/docs`, OpenAPI: `http://localhost:8000/openapi.json` (только dev).
- Healthcheck: `GET http://localhost:8000/api/v1/health`.

### Миграции Alembic

```bash
cd backend

alembic current                              # текущая ревизия
alembic history --verbose                    # история
alembic upgrade head                         # применить все
alembic downgrade -1                         # откатить последнюю
alembic revision --autogenerate -m "add playback revision"
```

Правила:

- после autogenerate обязательно прочитать и поправить миграцию (индексы, constraints, `server_default`);
- одна миграция — одно логическое изменение;
- `downgrade` обязателен;
- миграции пишет Backend-разработчик (см. [TEAM_WORKFLOW.md](./TEAM_WORKFLOW.md));
- перед PR: `alembic upgrade head` на чистой БД + `alembic downgrade base && alembic upgrade head`.

### Тесты

```bash
cd backend
pytest                                   # всё
pytest tests/unit                        # быстрые unit
pytest tests/integration                 # REST + БД
pytest tests/realtime                    # WebSocket
pytest -k "playback" -q                  # по имени
```

Требования:

- `TEST_DATABASE_URL` указывает на отдельную БД;
- фикстура один раз применяет `alembic upgrade head`, затем очищает таблицы между тестами;
- тесты не ходят в настоящий YouTube;
- время в playback-тестах подменяется через `Clock`, а не `sleep`.

### Линтинг и форматирование

```bash
cd backend
ruff check .
ruff format --check .
mypy app
```

`ruff format` (line length 100) — единственный форматтер Python. Autofix: `ruff check --fix .`.

## 6. Frontend

### Установка и запуск

```bash
cd frontend
corepack enable
yarn install
yarn dev
```

Vite поднимает `http://localhost:5173`. Если backend на 8000, CORS уже разрешает этот origin.

### Скрипты `package.json`

| Команда | Что делает |
| --- | --- |
| `yarn dev` | Vite dev server |
| `yarn build` | `tsc -b && vite build` |
| `yarn preview` | Просмотр production-сборки |
| `yarn lint` | ESLint |
| `yarn lint:fix` | ESLint с автоисправлением |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn test` | Vitest (однократно) |
| `yarn test:watch` | Vitest watch |

### Стиль

- Prettier из корневого `.prettierrc.json` (single quotes, 100 символов, LF);
- ESLint — `eslint.config.js`, правила React Hooks и TypeScript;
- запрещены `any` без обоснования и `@ts-ignore` без комментария;
- импорты через alias `@/` (настраивается в `vite.config.ts` и `tsconfig`).

## 7. Полный чек перед PR

```bash
# frontend
cd frontend && yarn lint && yarn typecheck && yarn test && yarn build

# backend
cd backend && ruff check . && ruff format --check . && mypy app && pytest
```

CI выполняет те же шаги. Локально допустимо прогнать только затронутую часть, но перед merge —
всё.

## 8. Типичные проблемы

| Симптом | Причина | Решение |
| --- | --- | --- |
| `connection refused` к PostgreSQL | контейнер не запущен | `docker compose up -d db` |
| `password authentication failed` | неверный `DATABASE_URL` | сверить с compose |
| `502`/CORS в браузере | backend не на 8000 или origin не в `CORS_ORIGINS` | проверить порт и env |
| WebSocket `403` | ticket истёк/использован, неверный `Origin` | получить новый ticket, проверить `CORS_ORIGINS` |
| `NotAllowedError` при play | autoplay заблокирован браузером | оверлей «Нажмите, чтобы синхронизироваться»; это штатное поведение |
| `relation does not exist` | не применены миграции | `alembic upgrade head` |
| Тесты падают на схеме | тестовая БД не создана/не обновлена | создать `watchtogether_test`, применить миграции |
| Порт занят | запущен другой процесс | сменить порт (`--port`) или остановить процесс |
| Дрейф видео | буферизация/реклама YouTube | watchdog клиента; проверить логи `revision` |

## 9. Docker-сборка

- `backend/Dockerfile`: `python:3.12-slim`, установка зависимостей, `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`.
- `frontend/Dockerfile`: multi-stage `node:22-alpine` → `yarn build` → `nginx:1.27-alpine`.
- `infra/docker/nginx.conf`: SPA fallback (`try_files $uri /index.html`), проксирование
  `/api/` и `/ws/` на backend, security headers из [SECURITY.md](./SECURITY.md#8-cors-csp-и-заголовки).

Nginx-прокси для WebSocket обязан передавать заголовки `Upgrade` и `Connection`:

```nginx
location /api/v1/ws/ {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```
