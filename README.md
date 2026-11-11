# WatchTogether

Совместный просмотр видео: React + TypeScript + Vite, ESLint (flat config) + Prettier, yarn.

## Требования

- Node.js >= 20 (`.nvmrc` → 22)
- yarn 1.22 (`npm i -g yarn`)

## Команды

| Команда          | Что делает                                   |
| ---------------- | -------------------------------------------- |
| `yarn install`   | установить зависимости                       |
| `yarn dev`       | dev-сервер на http://localhost:5173          |
| `yarn build`     | typecheck + production-сборка в `dist/`      |
| `yarn preview`   | локально посмотреть собранный `dist/`        |
| `yarn lint`      | ESLint по всему проекту (`--fix` — автофикс) |
| `yarn typecheck` | `tsc --noEmit`                               |
| `yarn format`    | Prettier (`format:check` — только проверка)  |

## Структура

```
.
├─ src/              # веб-приложение
│  ├─ app/           # точка входа, провайдеры, глобальные стили
│  ├─ pages/         # страницы (роутинг)
│  ├─ components/    # переиспользуемые UI-компоненты
│  ├─ hooks/         # react-хуки
│  ├─ services/      # API/websocket-клиенты, мапперы
│  └─ utils/         # чистые хелперы
├─ framework/        # каркасный слой: константы, обёртки над API платформы
├─ native/           # код для нативных клиентов (RN/WebView-мосты)
├─ infra/            # Docker, nginx, деплой
├─ .github/          # CI (lint → typecheck → build)
├─ eslint.config.js  # ESLint flat config
├─ vite.config.ts    # алиасы @, @framework, @infra, @native
└─ tsconfig.json     # strict TypeScript
```

Правило зависимостей: `src` → `framework` → `native`; обратных импортов быть не должно.
UI и бизнес-логика в `framework`/`native` не кладутся.

## Docker

```bash
docker build -f infra/docker/Dockerfile -t watch-together .
docker run -p 8080:80 watch-together
```
