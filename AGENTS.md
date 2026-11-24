# AGENTS.md — общие правила проекта Watch Party

Этот файл читают AI-агенты и разработчики перед любой задачей. Он дополняет `docs/`, но не
заменяет её: контракты описаны в документах, здесь — границы и порядок работы.

## Что за проект

Watch Party — веб-приложение для синхронного просмотра YouTube. React + TypeScript + Vite +
Tailwind на фронтенде, FastAPI + PostgreSQL + WebSocket на бэкенде. Регистрации нет: доступ по
ссылке и имени, роли `owner` и `member`.

## Источник истины

1. `docs/ARCHITECTURE.md` — модули, зависимости, потоки.
2. `docs/API.md` — REST-контракт.
3. `docs/WEBSOCKET.md` — WS-контракты, синхронизация, presence.
4. `docs/DATABASE.md` — схема БД, ограничения, индексы.
5. `docs/SECURITY.md` — токены, права, лимиты, валидация.
6. `docs/PROJECT_STRUCTURE.md` — куда класть код.
7. `docs/TEAM_WORKFLOW.md` — процесс, зоны, contract-first.
8. `docs/TESTING.md` — что и как проверять.
9. `docs/CHANGELOG_DEV.md` — история решений.

Если код и docs расходятся — прав код считается ошибкой. Если задача требует изменить контракт,
сначала предложи docs-PR, не придумывай новые поля/события/endpoint'ы.

## Зоны ответственности

- `frontend/src/{app,pages,components,hooks,api,lib,styles,player}` — Frontend.
- `backend/app/{api,core,rooms,participants,chat,use_cases}`, `backend/alembic/**`,
  `backend/tests/{unit,integration}`, `infra/**`, `docker-compose.yml`, `.github/**` — Backend.
- `backend/app/websocket/**`, `backend/app/playback/**`, `backend/tests/realtime/**`,
  `frontend/src/realtime/**` — Realtime.
- `docs/**`, корневые конфиги, `AGENTS.md` — общие; изменения через PR и ревью.

Не редактируй чужие зоны без явного указания в задаче. Не делай mass-rename и переформатирование
чужих файлов.

## Технические инварианты

- Backend — единственный источник истины playback. Состояние = `position_seconds` + `updated_at` +
  `revision`; актуальную позицию вычисляет клиент.
- Никакого периодического broadcast playback. Только команда, `sync.request`, snapshot.
- REST — жизненный цикл; WebSocket — live-операции. Не дублируй мутации в двух каналах.
- JSON везде `snake_case`, имена полей одинаковы в REST, WS и frontend-типах.
- Токен доступа не попадает в URL и логи. WS — только одноразовый ticket (60 с).
- Роль берётся из БД, никогда из запроса.
- Presence, соединения и rate limit — в памяти; MVP работает с `--workers 1`.
- Секреты только из окружения. Никаких токенов, паролей и текстов сообщений в логах.
- Не добавляй зависимости без согласования: стек зафиксирован в docs.

## Команды проверки

```bash
# frontend
cd frontend && yarn lint && yarn typecheck && yarn test && yarn build

# backend
cd backend && ruff check . && ruff format --check . && mypy app && pytest
```

Перед PR обязательны проверки затронутой части. Если тесты не запускались — PR не готов.

## Правила работы агента

1. Прочитай свой зональный `AGENTS.md` (`backend/`, `frontend/`, `backend/app/websocket/`).
2. Составь план в рамках указанных файлов; не расширяй задачу.
3. Не меняй контракты «по пути»: остановись и перечисли вопросы.
4. Не оставляй `TODO` вместо архитектурного решения.
5. Не коммить секреты, `.env`, артефакты сборки.
6. После изменений запусти проверки и приложи результат.
7. В PR укажи зону, контракты, проверки, ручные сценарии.
8. Спорное решение — в issue с меткой `architecture`, затем запись в `CHANGELOG_DEV.md`.

## Definition of Done

Код в своей зоне + тесты + lint/typecheck/mypy + обновлённые docs (если менялось поведение) +
запись в CHANGELOG_DEV (для контрактов/архитектуры) + approvals по
`docs/TEAM_WORKFLOW.md#4-pull-requests`.
