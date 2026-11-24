# AGENTS.md — backend/app/websocket/

Действуют корневой `AGENTS.md`, `backend/AGENTS.md` и `docs/WEBSOCKET.md`. Здесь — правила
realtime-зоны.

## Границы

- Владелец зоны — Realtime. `app/websocket/**` и `app/playback/**` не редактируются другими
  разработчиками без согласования.
- `app/websocket` не содержит SQL и бизнес-правил: handler валидирует событие, вызывает сервис,
  затем просит `ConnectionManager` разослать результат.
- `app/websocket/publisher.py` реализует порт `core.events.RoomEventPublisher`: REST-операции
  `leave`/закрытие комнаты приходят сюда, а не импортируют `websocket` напрямую.
- Состояние playback меняет только `app/playback/service.py`. Handler не пишет в БД напрямую.
- Presence, соединения, grace-таймеры и heartbeat — только в памяти. В БД — `connected_at`,
  `disconnected_at`, `last_seen_at` (throttled).

## Контракт

- Имена событий и поля — строго из `docs/WEBSOCKET.md`. Новое событие = docs-PR + тип в
  `frontend/src/realtime/protocol.ts` + запись в `CHANGELOG_DEV.md`.
- Конверт: `{type, event_id, room_code, server_time, request_id?, payload}` для S→C;
  `{type, request_id?, payload}` для C→S.
- `access_token` в URL не используется: только одноразовый ticket (JWT, 60 с, `jti`).
- Ошибки — `error` с кодом из docs; не закрывай соединение на первую ошибку валидации.
- `playback.state` рассылается после commit и только при реальном изменении состояния.

## Синхронизация

- Сервер — источник истины: `position_seconds` + `updated_at` + `revision`.
- Никакого периодического broadcast. События: команда, `sync.request`, snapshot, вход.
- Порядок команд: `asyncio.Lock` комнаты + `SELECT ... FOR UPDATE` строки `playback_states`.
- `revision` строго возрастает; клиент игнорирует меньшие значения.
- `play`/`pause` с расхождением > 3 с от серверной позиции → `stale_position`.
- Watchdog и коррекция дрейфа — на клиенте (`frontend/src/realtime/syncEngine.ts`).

## Presence

- Онлайн = есть хотя бы одно соединение участника.
- Последнее соединение закрылось → grace 15 с; reconnect отменяет `participant.left`.
- Явный `leave`/закрытие комнаты — без grace.
- Heartbeat: server ping 25 с, timeout 10 с. Закрытие сокета запускает grace.
- Broadcast'ы presence — всем соединениям комнаты, кроме инициатора (snapshot уже отправлен).

## Тесты и проверки

```bash
pytest tests/unit/test_playback_math.py tests/realtime -q
ruff check app/websocket app/playback && mypy app
```

Обязательные сценарии — из `docs/TESTING.md#5-тестирование-websocket-и-синхронизации`. Тест
обязан проверять отсутствие лишних событий (никакого «фонового» broadcast).

## Запрещено

- отправлять состояние каждую секунду/по таймеру;
- хранить соединения или presence в БД;
- логировать ticket и тексты сообщений;
- запускать backend с `--workers > 1` (in-memory presence станет некорректным);
- менять БД-поля `playback_states` без миграции и согласования с Backend.
