# WatchTogether — Сайт для совместного просмотра видео

Проект для синхронного просмотра YouTube видео с чатом и комнатами.

## 🏗 Структура проекта

```text
WatchTogether/
├── frontend/             # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/   # UI компоненты (Player, Chat, etc.)
│   │   ├── hooks/        # Кастомные хуки (useSocket, useYouTube)
│   │   ├── pages/        # Страницы (Home, Room)
│   │   └── services/     # API клиенты
│   ├── Dockerfile
│   └── package.json
├── backend/              # Python + FastAPI
│   ├── app/
│   │   ├── api/          # Эндпоинты (rooms, auth)
│   │   ├── core/         # Конфигурация
│   │   ├── models.py     # SQLAlchemy модели
│   │   ├── schemas.py    # Pydantic схемы
│   │   └── main.py       # Точка входа и WebSocket логика
│   ├── alembic/          # Миграции БД
│   ├── Dockerfile
│   └── requirements.txt
├── infra/                # Конфигурации инфраструктуры (nginx, etc.)
└── docker-compose.yml    # Запуск всего стека (Frontend, Backend, DB)
```

## 👥 Распределение ролей (3 человека)

### 1. Frontend Developer (UI/UX & Integration)
**Зона ответственности:** Интерфейс, маршрутизация и работа с YouTube API.
- **Основные задачи:**
    - Реализация UI комнат, чата и плеера на Tailwind CSS.
    - Интеграция `YouTube IFrame Player API`.
    - Управление локальным состоянием плеера.
- **Ключевые функции:**
    - `loadVideo(videoId: string): void` — загрузка видео по ID.
    - `syncVideo(time: number, state: PlayerState): void` — установка времени и состояния (play/pause).
    - `handleSendMessage(text: string): void` — отправка сообщения в интерфейсе.

### 2. Backend Developer (API & Data)
**Зона ответственности:** Серверная логика, база данных и API.
- **Основные задачи:**
    - Проектирование схемы БД (Комнаты, Пользователи, Сообщения).
    - Реализация REST API для управления комнатами.
    - Настройка SQLAlchemy и Alembic миграций.
- **Ключевые функции/эндпоинты:**
    - `POST /api/rooms` -> `RoomSchema` — создание комнаты.
    - `GET /api/rooms/{id}` -> `RoomDetailSchema` — получение данных комнаты.
    - `get_chat_history(room_id: int) -> List[Message]` — получение истории чата.

### 3. Real-time & DevOps (Sync & Infra)
**Зона ответственности:** WebSocket-синхронизация, Docker и инфраструктура.
- **Основные задачи:**
    - Реализация WebSocket сервера для передачи событий (Play/Pause/Seek).
    - Алгоритм синхронизации (обработка задержек, мастер-клиент).
    - Docker Compose конфигурация и развертывание.
- **Ключевые функции:**
    - `broadcast_event(room_id, payload)` — рассылка события всем участникам.
    - `handle_ws_connect(room_id, user_id)` — управление подключениями.
    - Настройка взаимодействия между контейнерами.

## 🚀 Запуск проекта

1. Убедитесь, что у вас установлен Docker и Docker Compose.
2. Запустите проект:
   ```bash
   docker-compose up --build
   ```
3. Frontend будет доступен по адресу `http://localhost:5173`
4. Backend API будет доступен по адресу `http://localhost:8000`
