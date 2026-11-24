# AGENTS.md — backend/

Действуют общие правила из корневого `AGENTS.md` и `docs/`. Здесь — специфика Python/FastAPI.

## Стек и структура

Python 3.12, FastAPI, SQLAlchemy 2 async (`asyncpg`), Alembic, Pydantic v2, PostgreSQL 16.
Модуль = папка `app/<module>/` с `models.py`, `repository.py`, `schemas.py`, `service.py`.
Роутеры — только `app/api/routes/`. Межмодульная оркестрация — `app/use_cases/`.
Настройки — `app/core/config.py`; время — `app/core/clock.py`; ошибки — `app/core/errors.py`;
чистый парсер ссылок — `app/core/youtube.py`; порт событий для REST — `app/core/events.py`.

## Жёсткие правила

- SQL только в `repository.py` своего модуля. Никаких запросов в роутерах, сервисах и WS-handler'ах.
- Не импортируй `models.py`/`repository.py` другого модуля. Только его `service.py` и `schemas.py`.
- Роутер: разбор запроса → вызов сервиса/use case → маппинг ошибки. Бизнес-логики в роутере нет.
- Любая ошибка — подкласс `AppError` с `code` из `docs/API.md`. Формат ответа единый:
  `{"error": {"code", "message", "details"}}`. Не придумывай новые коды без docs.
- Все лимиты, TTL и пороги — в `config.py`, не в виде магических чисел.
- Время — только через `Clock`, иначе playback-тесты станут недетерминированными.
- Мутации, затрагивающие 2+ модуля, выполняются в одной транзакции через `UnitOfWork` в
  `use_cases/`. Не делай «частично сохранённую» комнату.
- `access_token` возвращается только из `create`/`join`. В БД — только sha256-хеш.
- REST-операции `leave` и закрытие комнаты не импортируют `websocket`: они вызывают порт
  `RoomEventPublisher` из `core/events.py`. Реализацию порта пишет Realtime.
- Никаких `print`, `datetime.utcnow()`, `requests`, синхронных драйверов БД.
- Не редактируй `app/websocket/**` и `app/playback/**` — это зона Realtime. Нужно изменение —
  issue/PR с владельцем.

## Миграции

- `alembic revision --autogenerate -m "..."`, затем обязательно прочитать и исправить файл.
- Одна миграция — одно логическое изменение, обязательный `downgrade`.
- Имена constraints/индексов — явные, как в `docs/DATABASE.md`.
- Перед PR: `alembic upgrade head` на чистой БД и `alembic downgrade base && alembic upgrade head`.
- Не меняй уже смерженные миграции. Конфликт ревизий — `alembic merge`, согласовав с командой.

## Тесты

- `pytest tests/unit`, `pytest tests/integration`; realtime-тесты не твоя зона.
- Тестовая БД — `TEST_DATABASE_URL`, миграции применяются фикстурой.
- Не ходи в сеть и в реальный YouTube, не используй `sleep`.
- Новый endpoint без интеграционного теста не считается готовым.
- `tests/conftest.py` общий: изменения согласуй с Realtime.

## Проверки

```bash
ruff check . && ruff format --check . && mypy app && pytest tests/unit tests/integration
```

## Запрещено

- менять REST-контракт без PR в `docs/API.md` и записи в `CHANGELOG_DEV.md`;
- добавлять поля в ответ «на будущее»;
- логировать токены, ticket, тексты сообщений;
- отключать CORS `*`, `allow_credentials` с `*`, `--workers > 1`;
- использовать `Base.metadata.create_all()` в runtime или тестах вместо Alembic.
