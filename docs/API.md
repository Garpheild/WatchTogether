# REST API

Базовый URL: `http://localhost:8000/api/v1` (dev). Все ответы — JSON, кодировка UTF-8.

Связанные документы: [WEBSOCKET.md](./WEBSOCKET.md) (live-операции), [DATABASE.md](./DATABASE.md)
(поля и ограничения), [SECURITY.md](./SECURITY.md) (токены и права).

## 1. Общие соглашения

| Правило | Значение |
| --- | --- |
| Формат полей | `snake_case`; те же имена используются в WebSocket |
| Время | ISO 8601 UTC с миллисекундами и `Z`: `2026-11-24T18:05:00.000Z` |
| Длительности | секунды, число с плавающей точкой: `42.5` |
| Идентификаторы | `participant_id`, `room_code` — строки; `message_id` — целое число |
| `null` | Всегда присутствует в ответе, если поле необязательное |
| Неизвестные поля в запросе | Ошибка `422 validation_error` (`extra = forbid`) |
| Аутентификация | `Authorization: Bearer wt_...` для всех endpoint'ов, кроме `POST /rooms`, `POST /rooms/{room_code}/join`, `GET /health` |
| CORS | Только origins из `CORS_ORIGINS` (dev: `http://localhost:5173`) |
| Ограничение тела | 16 КБ на JSON-запрос |

Токен доступа выдаётся **только** в ответах `POST /rooms` и `POST /rooms/{room_code}/join`.
Повторно получить его нельзя. Клиент хранит токен отдельно для каждого `room_code`.

## 2. Формат ошибок

Единый конверт для REST и WebSocket:

```json
{
  "error": {
    "code": "room_full",
    "message": "Room has reached the maximum number of participants",
    "details": { "max_participants": 10 }
  }
}
```

- `code` — машиночитаемый код, по нему фронтенд выбирает текст для пользователя;
- `message` — отладочный текст на английском, не показывается пользователю;
- `details` — объект или `null`; для ошибок валидации содержит список полей.

| `code` | HTTP | Когда возникает |
| --- | --- | --- |
| `validation_error` | 422 | Неверная схема, длина, формат `video_url`, лишние поля |
| `invalid_token` | 401 | Токен отсутствует, не найден, отозван |
| `forbidden` | 403 | Токен принадлежит другой комнате; действие требует `owner`; участник вышел |
| `room_not_found` | 404 | Нет комнаты с таким `room_code` |
| `room_closed` | 409 | Комната закрыта, а операция требует `active` |
| `room_full` | 409 | В комнате уже `max_participants` активных участников |
| `name_taken` | 409 | Имя занято активным участником (регистронезависимо) |
| `owner_must_close` | 409 | Владелец пытается выйти через `leave` |
| `rate_limited` | 429 | Превышен лимит запросов; есть заголовок `Retry-After` |
| `internal_error` | 500 | Непредвиденная ошибка; детали только в логах |

Пример ошибки валидации:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": {
      "fields": [
        { "field": "display_name", "reason": "must be 1..32 characters after trim" },
        { "field": "video_url", "reason": "unsupported YouTube URL" }
      ]
    }
  }
}
```

## 3. DTO

### `Room`

```json
{
  "room_code": "k7m2p9qx",
  "title": "Вечерний просмотр",
  "status": "active",
  "max_participants": 10,
  "created_at": "2026-11-24T18:00:00.000Z",
  "closed_at": null
}
```

### `Participant`

```json
{
  "participant_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "display_name": "Борис",
  "role": "member",
  "is_online": true,
  "joined_at": "2026-11-24T18:02:10.000Z"
}
```

`is_online` вычисляется по активным WebSocket-соединениям в памяти backend. Сразу после `join`
(до подключения сокета) значение `false`.

### `PlaybackState`

```json
{
  "video_id": "dQw4w9WgXcQ",
  "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "is_playing": true,
  "position_seconds": 42.5,
  "updated_at": "2026-11-24T18:05:00.000Z",
  "revision": 17,
  "updated_by_participant_id": "0f8fad5b-d9cb-469f-a165-70867728950e"
}
```

**Важно:** `position_seconds` — позиция на момент `updated_at`, а не «сейчас». Актуальную позицию
клиент считает сам:

```text
current = is_playing ? position_seconds + (now_server − updated_at) : position_seconds
```

Сервер не отдаёт отдельное поле `current_position`, чтобы не было двух источников истины. Если
`video_id = null`, видео ещё не выбрано: `is_playing = false`, `position_seconds = 0`.

### `Message`

```json
{
  "message_id": 128,
  "room_code": "k7m2p9qx",
  "participant_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "display_name": "Борис",
  "text": "Начинаем?",
  "created_at": "2026-11-24T18:06:00.000Z",
  "client_message_id": "c56a4180-65aa-42ec-a945-5fd21dec0538"
}
```

### `RoomDetail` + токен

Ответ `create` и `join`:

```json
{
  "room": { "...Room..." },
  "playback": { "...PlaybackState..." },
  "participants": [{ "...Participant..." }],
  "you": { "participant_id": "0f8fad5b-d9cb-469f-a165-70867728950e", "role": "owner" },
  "access_token": "wt_Vb2n8Kq1sT4xR7mZ0pLcY6hJ3fD9gA5wE2uI8oN1kQ"
}
```

`access_token` — пример; реальный токен имеет префикс `wt_` и 43 символа base64url после него.
`you` повторяется и в `GET /rooms/{room_code}`, но без `access_token`.

## 4. Endpoint'ы

### 4.1 `GET /health`

Публичный healthcheck. Авторизация не нужна.

**200**

```json
{ "status": "ok", "version": "1.0.0" }
```

---

### 4.2 `POST /rooms` — создание комнаты

Публичный. Создаёт комнату, владельца и пустое playback-состояние в одной транзакции.

**Request**

```json
{
  "display_name": "Аня",
  "title": "Вечерний просмотр",
  "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

| Поле | Тип | Обяз. | Ограничения |
| --- | --- | --- | --- |
| `display_name` | string | да | trim 1..32, без control-символов; имя владельца |
| `title` | string \| null | нет | trim ≤ 80; `null` допустим |
| `video_url` | string \| null | нет | поддерживаемая YouTube-ссылка (раздел 6); `null` — комната без видео |

**201** — `RoomDetail` + `access_token` (см. раздел 3). Владелец уже в `participants` с
`role = "owner"`, `is_online = false`.

```json
{
  "room": {
    "room_code": "k7m2p9qx",
    "title": "Вечерний просмотр",
    "status": "active",
    "max_participants": 10,
    "created_at": "2026-11-24T18:00:00.000Z",
    "closed_at": null
  },
  "playback": {
    "video_id": "dQw4w9WgXcQ",
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "is_playing": false,
    "position_seconds": 0,
    "updated_at": "2026-11-24T18:00:00.000Z",
    "revision": 0,
    "updated_by_participant_id": null
  },
  "participants": [
    {
      "participant_id": "0f8fad5b-d9cb-469f-a165-70867728950e",
      "display_name": "Аня",
      "role": "owner",
      "is_online": false,
      "joined_at": "2026-11-24T18:00:00.000Z"
    }
  ],
  "you": { "participant_id": "0f8fad5b-d9cb-469f-a165-70867728950e", "role": "owner" },
  "access_token": "wt_Vb2n8Kq1sT4xR7mZ0pLcY6hJ3fD9gA5wE2uI8oN1kQ"
}
```

**Ошибки:** `422 validation_error`, `429 rate_limited`, `500 internal_error`.

**Лимит:** 5 созданий в час на IP.

---

### 4.3 `POST /rooms/{room_code}/join` — вход в комнату

Публичный. Создаёт участника с `role = "member"` и выдаёт его токен.

**Request**

```json
{ "display_name": "Борис" }
```

**201** — `RoomDetail` + `access_token`:

```json
{
  "room": { "...Room..." },
  "playback": { "...PlaybackState..." },
  "participants": [
    { "...владелец..." },
    {
      "participant_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "display_name": "Борис",
      "role": "member",
      "is_online": false,
      "joined_at": "2026-11-24T18:02:10.000Z"
    }
  ],
  "you": { "participant_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "role": "member" },
  "access_token": "wt_9sK2mQ7xT1pR4vZ8nLcY6hJ3fD0gA5wE2uI8oN1kQ"
}
```

**Ошибки:** `404 room_not_found`, `409 room_closed`, `409 room_full`, `409 name_taken`,
`422 validation_error`, `429 rate_limited`.

Проверка лимита и вставка выполняются под `SELECT ... FOR UPDATE` строки комнаты, поэтому 11-й
участник не пройдёт даже при одновременных запросах.

**Лимит:** 10 входов в минуту на IP.

---

### 4.4 `GET /rooms/{room_code}` — состояние комнаты

Требует токен участника этой комнаты. Используется при загрузке страницы и после REST-действий,
но не заменяет `room.snapshot` для live-состояния.

**200**

```json
{
  "room": { "...Room..." },
  "playback": { "...PlaybackState..." },
  "participants": [{ "...Participant..." }],
  "you": { "participant_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "role": "member" }
}
```

`participants` включает всех, у кого `left_at IS NULL`, включая offline. Порядок: владелец
первым, остальные по `joined_at`.

Закрытая комната тоже возвращается (`status = "closed"`, `closed_at` заполнен) — это нужно, чтобы
показать экран «комната закрыта».

**Ошибки:** `401 invalid_token`, `403 forbidden` (токен от другой комнаты или участник вышел),
`404 room_not_found`.

---

### 4.5 `GET /rooms/{room_code}/messages` — история чата

Требует токен участника. Отдаёт страницу истории для прокрутки вверх. Live-сообщения приходят
через WebSocket (`chat.message`), этот endpoint — только архив.

**Query**

| Параметр | Тип | Обяз. | По умолчанию | Ограничения |
| --- | --- | --- | --- | --- |
| `limit` | int | нет | 50 | 1..100 |
| `before_id` | int | нет | — | вернуть сообщения с `message_id < before_id` |

**200**

```json
{
  "messages": [
    {
      "message_id": 126,
      "room_code": "k7m2p9qx",
      "participant_id": "0f8fad5b-d9cb-469f-a165-70867728950e",
      "display_name": "Аня",
      "text": "Начинаем?",
      "created_at": "2026-11-24T18:05:30.000Z",
      "client_message_id": null
    },
    {
      "message_id": 127,
      "room_code": "k7m2p9qx",
      "participant_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "display_name": "Борис",
      "text": "Да, секунду",
      "created_at": "2026-11-24T18:05:40.000Z",
      "client_message_id": "c56a4180-65aa-42ec-a945-5fd21dec0538"
    }
  ],
  "has_more": true
}
```

`messages` всегда в возрастающем порядке `message_id`. `has_more = true` означает, что существуют
сообщения старше первого элемента страницы; следующая страница запрашивается с
`before_id = messages[0].message_id`.

**Ошибки:** `401 invalid_token`, `403 forbidden`, `404 room_not_found`, `422 validation_error`.

---

### 4.6 `POST /rooms/{room_code}/ws-ticket` — краткоживущий ticket для WebSocket

Требует токен участника. Постоянный токен в URL WebSocket не передаётся.

**Request:** тело отсутствует.

**200**

```json
{
  "ticket": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YzllNjY3OS03NDI1LTQwZGUtOTQ0Yi1lMDdmYzFmOTBhZTciLCJyb29tIjoiazdtMnA5cXgiLCJyb2xlIjoibWVtYmVyIiwianRpIjoiYzU2YTQxODAtNjVhYS00MmVjLWE5NDUtNWZkMjFkZWMwNTM4IiwiZXhwIjoxNzY0MDA3NTIwfQ.example",
  "expires_at": "2026-11-24T18:07:00.000Z"
}
```

- TTL — 60 секунд (`WS_TICKET_TTL_SECONDS`);
- ticket одноразовый: повторное использование отклоняется;
- ticket привязан к `participant_id` и `room_code`, поэтому не может открыть другую комнату;
- в URL допускается только ticket, не `access_token`.

**Ошибки:** `401 invalid_token`, `403 forbidden`, `409 room_closed`, `404 room_not_found`,
`429 rate_limited`.

**Лимит:** 10 ticket'ов в минуту на участника, 30 в минуту на IP.

---

### 4.7 `POST /rooms/{room_code}/leave` — добровольный выход

Требует токен участника. Ставит `left_at`, освобождает место, инициирует `participant.left`.

**204 No Content.**

- Владелец не может выйти: `409 owner_must_close` (он должен закрыть комнату).
- После успешного выхода токен отзывается: повторный `leave` вернёт `403 forbidden`. Это
  осознанно — клиент не должен продолжать работу с отозванным токеном.
- WebSocket-соединения участника закрываются кодом `4403`.

**Ошибки:** `401 invalid_token`, `403 forbidden`, `404 room_not_found`, `409 owner_must_close`.

---

### 4.8 `DELETE /rooms/{room_code}` — закрытие комнаты

Только `owner`. Закрывает комнату навсегда: `status = "closed"`, `closed_at = now()`.
Backend рассылает `room.closed` и закрывает все сокеты кодом `4409`.

**204 No Content.** Идемпотентно: повторный вызов тоже `204`, повторный broadcast не выполняется.

**Ошибки:** `401 invalid_token`, `403 forbidden` (не владелец), `404 room_not_found`.

## 5. Примеры запросов

```bash
# создать комнату
curl -X POST http://localhost:8000/api/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Аня","title":"Вечерний просмотр","video_url":"https://youtu.be/dQw4w9WgXcQ"}'

# войти
curl -X POST http://localhost:8000/api/v1/rooms/k7m2p9qx/join \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Борис"}'

# состояние комнаты
curl http://localhost:8000/api/v1/rooms/k7m2p9qx \
  -H "Authorization: Bearer wt_..."

# история чата
curl "http://localhost:8000/api/v1/rooms/k7m2p9qx/messages?limit=50&before_id=128" \
  -H "Authorization: Bearer wt_..."

# ticket для WebSocket
curl -X POST http://localhost:8000/api/v1/rooms/k7m2p9qx/ws-ticket \
  -H "Authorization: Bearer wt_..."

# закрыть комнату (владелец)
curl -X DELETE http://localhost:8000/api/v1/rooms/k7m2p9qx \
  -H "Authorization: Bearer wt_..."
```

## 6. Валидация YouTube-ссылок

Сервер принимает `video_url` и сохраняет только `video_id` (11 символов). Поддерживаемые формы:

| Форма | Пример |
| --- | --- |
| `youtube.com/watch?v=ID` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s` |
| `youtu.be/ID` | `https://youtu.be/dQw4w9WgXcQ?si=abc` |
| `youtube.com/embed/ID` | `https://www.youtube.com/embed/dQw4w9WgXcQ` |
| `youtube.com/shorts/ID` | `https://youtube.com/shorts/dQw4w9WgXcQ` |
| `youtube.com/live/ID` | `https://www.youtube.com/live/dQw4w9WgXcQ` |
| `music.youtube.com/watch?v=ID` | `https://music.youtube.com/watch?v=dQw4w9WgXcQ` |
| `youtube-nocookie.com/embed/ID` | `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ` |

Правила:

- допустимы только хосты из списка; остальные (`youtube.com.evil.tld`, IP-адреса, `javascript:`)
  отклоняются;
- `video_id` обязан соответствовать `^[A-Za-z0-9_-]{11}$`;
- лишние query-параметры (`t`, `si`, `list`) отбрасываются, `playlist` не поддерживается;
- в ответах всегда возвращается канонический `video_url`:
  `https://www.youtube.com/watch?v={video_id}`;
- пустая строка и `null` трактуются как «видео не выбрано» при создании комнаты.

Frontend дополнительно валидирует ссылку для мгновенной подсказки, но окончательное решение
принимает backend.

## 7. Инварианты, которые обязан соблюдать backend

1. `access_token` возвращается только в `201` ответах `create` и `join`, никогда — в `GET`.
2. Роль берётся из БД; поля `role` в запросе не существует.
3. Любая мутация комнаты/playback/чата проверяет, что `participant.room_id` соответствует
   `room_code` из пути.
4. `position_seconds` и `updated_at` меняются только вместе; `revision` строго возрастает.
5. `closed_at` непустой тогда и только тогда, когда `status = "closed"`.
6. Ошибки REST и WebSocket используют один набор `code` (таблица в разделе 2; WS-специфичные
   коды перечислены в [WEBSOCKET.md](./WEBSOCKET.md#10-ошибки-и-коды-закрытия)).

## 8. OpenAPI

FastAPI публикует схему автоматически. В dev доступны `/docs` и `/openapi.json`; в production
Swagger UI отключается (`docs_url=None`), схема доступна только из CI/артефактов. Изменение
endpoint'а без обновления этого документа и схемы не допускается.
