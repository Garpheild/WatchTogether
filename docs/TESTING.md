# Тестирование

## 1. Стратегия

Пирамида: много быстрых unit-тестов, меньше интеграционных, немного сквозных ручных проверок.
Главный риск проекта — рассинхронизация playback и конкурентные изменения состояния, поэтому
realtime- и playback-тесты обязательны, а не «если останется время».

| Уровень | Что проверяет | Инструменты | Где |
| --- | --- | --- | --- |
| Unit | Формулы, валидация, токены, лимиты, чистые функции | pytest | `backend/tests/unit` |
| Integration | REST + БД + транзакции + миграции | pytest, httpx, PostgreSQL | `backend/tests/integration` |
| Realtime | WS handshake, события, broadcast, presence, reconnect | pytest, `TestClient` | `backend/tests/realtime` |
| Frontend unit/component | Компоненты, sync engine, парсинг ссылок | Vitest, React Testing Library | `frontend/src/**/*.test.*` |
| Manual QA | Реальный YouTube, два браузера, сеть | чек-лист | раздел 7 |

**Не входит в MVP:** нагрузочное тестирование, тесты на все браузеры, автотесты против реального
YouTube, E2E Playwright (можно добавить позже без изменения архитектуры).

## 2. Backend: окружение тестов

- `TEST_DATABASE_URL` указывает на отдельную БД `watchtogether_test`.
- Сессионная фикстура один раз применяет `alembic upgrade head` — миграции тестируются вместе с
  кодом.
- Между тестами таблицы очищаются (`TRUNCATE ... RESTART IDENTITY CASCADE`) или каждая транзакция
  откатывается.
- Тесты не используют production-БД и не ходят в сеть.
- Время подменяется через `Clock`/`FakeClock` из `app/core/clock.py`; `sleep` в тестах запрещён.
- Фабрики: `create_room(...)`, `join_room(...)`, `connect_ws(...)` возвращают готовые объекты и
  токены.

Пример фикстур:

```python
# tests/conftest.py
@pytest.fixture
async def room(client):
    response = await client.post("/api/v1/rooms", json={
        "display_name": "Аня",
        "video_url": "https://youtu.be/dQw4w9WgXcQ",
    })
    assert response.status_code == 201
    return response.json()

@pytest.fixture
async def member(client, room):
    response = await client.post(
        f"/api/v1/rooms/{room['room']['room_code']}/join",
        json={"display_name": "Борис"},
    )
    assert response.status_code == 201
    return response.json()
```

## 3. Unit-тесты

| Файл | Что проверяется |
| --- | --- |
| `test_security.py` | Формат токена `wt_`, длина, sha256-хеш, уникальность; JWT ticket: подпись, `exp`, `room`, `jti`, повторное использование |
| `test_youtube_url.py` | Все поддерживаемые формы ссылок; отказ для чужих хостов, `javascript:`, IP, неверной длины id; канонический URL |
| `test_playback_math.py` | `current_position`: playing/paused, отрицательный elapsed, `updated_at` в будущем; no-op tolerance 0.25; tolerance play/pause 3 c; clamp позиции |
| `test_rate_limit.py` | Token bucket: burst, восстановление, изоляция по ключу, `Retry-After` |
| `test_room_codes.py` | Алфавит без похожих символов, длина 10, retry при коллизии |

Требования: unit-тесты не открывают БД и не требуют Docker.

## 4. Интеграционные тесты REST

| Сценарий | Ожидание |
| --- | --- |
| Создание комнаты | `201`, `role = owner`, `access_token` один раз, `playback.video_id` из ссылки |
| Создание без `video_url` | `201`, `video_id = null`, `is_playing = false` |
| Создание с неверной ссылкой | `422 validation_error` |
| Join | `201`, `role = member`, участник в `participants` |
| Join в закрытую | `409 room_closed` |
| Join с занятым именем | `409 name_taken` (включая другой регистр) |
| Join 11-го | `409 room_full`; при 10 одновременных запросах — ровно 10 успешных |
| Join с несуществующим кодом | `404 room_not_found` |
| GET комнаты без токена | `401 invalid_token` |
| GET комнаты с токеном другой комнаты | `403 forbidden` |
| GET комнаты участником после `leave` | `403 forbidden` |
| GET закрытой комнаты | `200`, `status = "closed"` |
| История чата | Пагинация `before_id`, `has_more`, возрастающий порядок |
| `ws-ticket` | `200`, ticket одноразовый, чужой комнате не подходит, после `leave` — `403` |
| `leave` владельца | `409 owner_must_close` |
| `DELETE` не владельцем | `403 forbidden` |
| `DELETE` владельцем дважды | `204`, `room.closed` broadcast только один раз |
| Валидация | Пустое имя, имя > 32, текст > 500, лишнее поле → `422` |
| Rate limit | `429` + `Retry-After` |

Проверяется также, что `GET` никогда не возвращает `access_token`.

## 5. Тестирование WebSocket и синхронизации

`TestClient` из Starlette позволяет открыть несколько сокетов и проверить порядок событий.
Хелпер `connect_ws(client, room_code, access_token)` получает ticket через REST и подключается.

### Обязательные сценарии

| Сценарий | Ожидание |
| --- | --- |
| Handshake | `room.snapshot` первым событием; `you` совпадает с участником |
| Битый/использованный ticket | Handshake отклонён (HTTP 403) |
| `play` от member | `playback.state` с `reason = "command"` у всех, `revision + 1` |
| `pause` | `is_playing = false`, позиция у всех одинаковая |
| `seek` | Позиция обновлена, `is_playing` не изменился |
| `play` без видео | `error video_not_set`, состояние не меняется |
| `play` с устаревшей позицией (> 3 c) | `error stale_position`, broadcast нет |
| No-op `play` при уже играющем | Broadcast нет, отправитель получает `playback.state` |
| Новый участник во время play | Snapshot содержит `is_playing = true`, позицию и `updated_at` |
| `playback.sync.request` | Unicast `playback.state`, `reason = "sync_request"`, без broadcast |
| `room.sync.request` | `room.snapshot` с тем же `request_id` |
| `video.change` владельцем | `playback.state` с `reason = "video_change"`, позиция 0, пауза |
| `video.change` member'ом | `error forbidden`, состояние не меняется |
| `chat.send` | `chat.message` у всех, дедуп по `client_message_id`, порядок `message_id` |
| Пустой/длинный чат | `error validation_error`, соединение живо |
| Presence | `participant.joined` при подключении; `participant.left` после grace 15 c |
| Reconnect в течение grace | `participant.left` не отправляется, состояние восстанавливается snapshot'ом |
| Разрыв и reconnect | Snapshot актуален, `is_online` корректен, дубликатов участников нет |
| Две вкладки одного участника | Один `participant.joined`, offline только после закрытия обеих |
| `room.closed` | Broadcast, затем закрытие `4409`, повторный connect невозможен |
| Rate limit | `error rate_limited`, при спаме — `4429` |
| Неизвестный `type` | `error unsupported_event`, соединение живо |
| Размер > 4 КБ | Закрытие `1009` |

Пример теста воспроизведения:

```python
def test_play_is_broadcast_to_all(clients_two_members):
    ws_a, ws_b, code = clients_two_members
    ws_a.receive_json()  # snapshot
    ws_b.receive_json()

    ws_a.send_json({
        "type": "playback.command",
        "request_id": "a1b2c3d4-0000-4000-8000-123456789abc",
        "payload": {"action": "play", "position_seconds": 12.0},
    })

    event_a = ws_a.receive_json()
    event_b = ws_b.receive_json()

    assert event_a["type"] == "playback.state"
    assert event_b["type"] == "playback.state"
    assert event_a["payload"]["playback"]["is_playing"] is True
    assert event_a["payload"]["playback"]["revision"] == 1
    assert event_b["payload"]["playback"]["revision"] == 1
```

### Детерминированная проверка позиции

```python
def test_position_accounts_for_elapsed_time(playback_service, fake_clock):
    fake_clock.set("2026-11-24T18:00:00Z")
    state = playback_service.start(room_id, participant_id, position=10.0, playing=True)

    fake_clock.advance(seconds=5)
    assert playback_service.current_position(state) == 15.0
```

Для проверки `updated_at`/`server_time` в контракте используется фиксированный `Clock`, а не
реальное время.

### Проверка отсутствия периодического broadcast

В тесте с двумя клиентами после команды не должно быть событий, пока не истечёт время и не будет
новой команды или `sync.request`. Это защита от случайного «heartbeat каждую секунду».

## 6. Frontend-тесты

| Что | Инструмент | Проверки |
| --- | --- | --- |
| `syncEngine` | Vitest + fake player | Применение snapshot, игнор старой `revision`, seek при drift > 1, sync.request при drift > 3 с cooldown, отсутствие команд при `isApplyingRemote` |
| `socket` | Vitest + fake WebSocket | Backoff, запрос нового ticket на каждую попытку, обработка `4409` без реконнекта, дедуп сообщений |
| `youtube.ts` | Vitest | Те же ссылки, что в backend (таблица кейсов), канонизация |
| Компоненты чата | RTL | Отправка, оптимистичное сообщение, замена по `client_message_id`, автоскролл |
| Участники | RTL | Бейдж владельца, online/offline, пустой список |
| Join/Home | RTL | Ошибки `name_taken`, `room_full`, `room_closed`, редирект в комнату |
| Player adapter | Vitest | Маппинг статусов IFrame API, подавление событий при программных вызовах |

Sync engine тестируется без реального DOM и YouTube: fake player реализует `PlayerAdapter` и
управляет `currentTime` вручную. Это позволяет воспроизвести буферизацию и дрейф.

## 7. Ручные сценарии проверки

Выполняются в двух окнах браузера (обычное и приватное) с реальным YouTube. Chromium и Firefox —
минимум.

| № | Шаги | Ожидание |
| --- | --- | --- |
| 1 | Создать комнату с видео | Открывается `/r/{room_code}`, видео загружено, в списке один владелец |
| 2 | Скопировать ссылку, открыть в другом браузере, войти | Второй участник в списке, у обоих одинаковое состояние |
| 3 | Нажать play у второго участника | Владелец тоже начинает воспроизведение с той же позиции |
| 4 | Pause у владельца | У обоих пауза на одной позиции |
| 5 | Seek на 2 минуты у любого | У обоих позиция ≈ 2:00, расхождение < 1 c |
| 6 | Войти третьим во время play | Сразу видит актуальную позицию, без ручных действий |
| 7 | Отключить сеть у одного на 10 c | Баннер reconnect, после восстановления состояние синхронно |
| 8 | Закрыть вкладку участника | Через ~15 c участник исчезает из списка |
| 9 | Переключить вкладку в фон на 1 минуту | При возврате позиция корректируется watchdog'ом |
| 10 | Member пытается сменить видео | Кнопка недоступна; при попытке через API — `403`/`forbidden` |
| 11 | Owner меняет видео | У всех новое видео в паузе на 0:00 |
| 12 | Отправить сообщение | У всех появляется один раз, история сохраняется после перезагрузки |
| 13 | Ввести занятое имя | Ошибка «Имя занято», вход не выполняется |
| 14 | 11-й участник | Ошибка «Комната заполнена» |
| 15 | Owner закрывает комнату | У всех экран «Комната закрыта», reconnect не идёт |
| 16 | Перезагрузить страницу во время play | Восстановление сессии и актуальной позиции |
| 17 | Открыть ссылку без входа | Форма ввода имени, без доступа к чату/плееру |
| 18 | Заблокировать autoplay | Оверлей «Нажмите, чтобы синхронизироваться», после клика синхронизация |

Результаты фиксируются в PR/issue; найденные расхождения оформляются как bug с указанием
`revision`, `position_seconds`, `server_time` и времени события.

## 8. CI

```text
frontend job: yarn install → yarn lint → yarn typecheck → yarn test → yarn build
backend job:  pip install -e ".[dev]" → ruff check → ruff format --check → mypy app
              → alembic upgrade head (PostgreSQL service) → pytest
```

Требования:

- оба job'а обязательны для merge;
- backend job поднимает `postgres:16` service и создаёт `watchtogether_test`;
- тесты realtime входят в общий `pytest` (без отдельного job'а на MVP);
- падение любого шага блокирует PR.

Текущий `.github/workflows/ci.yml` переписывается под эту схему в первом инфраструктурном PR
(см. [TEAM_WORKFLOW.md](./TEAM_WORKFLOW.md#10-известные-задачи-процесса)).

## 9. Критерии готовности MVP

MVP считается готовым, когда одновременно выполнено:

- [ ] создание комнаты, вход по ссылке, имя, лимит 10 — работают и покрыты тестами;
- [ ] play/pause/seek синхронизируются у 2+ участников, расхождение ≤ 1 c в ручном тесте;
- [ ] новый участник получает актуальное состояние без действий;
- [ ] reconnect восстанавливает состояние, presence не «залипает»;
- [ ] чат доставляет сообщения, сохраняет историю и защищён от дублей;
- [ ] список участников корректен, owner помечен, offline исчезает после grace;
- [ ] только owner меняет видео и закрывает комнату; member получает `403`/`forbidden`;
- [ ] закрытая комната недоступна для входа и WS;
- [ ] rate limit и валидация работают, ошибки имеют единый формат;
- [ ] `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build`, `ruff`, `mypy`, `pytest` зелёные;
- [ ] CI зелёный, docs соответствуют реализации, CHANGELOG_DEV обновлён;
- [ ] ручные сценарии 1–18 пройдены в Chromium и Firefox;
- [ ] нет известных blocking-багов.
