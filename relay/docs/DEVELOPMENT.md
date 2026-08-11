# Development guide (for humans & AI agents)

## Repo root

Application lives in this folder (`relay/`). Parent `Notion 2/` may be empty wrapper.

## Before coding

1. Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and this file.
2. For Next.js APIs, prefer `node_modules/next/dist/docs/` over training data (see root `AGENTS.md`).
3. Keep changes tenant-safe: never fetch a page without membership join.

## Запуск (важно)

Рабочая папка приложения: **`relay/`**.

```bash
cd relay
npm run db:migrate
npm run dev          # сайт http://localhost:3000 (сам освобождает порт)
```

**Десктоп с рабочего стола**

| Ярлык | Когда |
|---|---|
| `Relay.bat` / `.vbs` | Обычный запуск (release, UI «заморожен» до rebuild) |
| `Relay-dev.bat` | Свежий UI сразу (API + Vite + окно) |
| `Relay-rebuild.bat` | Пересобрать release после правок дизайна, потом открыть |

Или из терминала:

```bash
cd relay
npm run dev                              # сайт
npm run desktop:start -- -Dev            # десктоп с живым UI
# после правок UI, чтобы обновить ярлык Relay.bat:
powershell -File scripts/start-desktop.ps1 -Rebuild
```

Открывай http://localhost:3000

Если страница «крутится вечно» — почти всегда зависший старый `node` на порту 3000. `npm run dev` теперь убивает его перед стартом. В крайнем случае: `npm run dev:clean`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Старт + авто-освобождение порта 3000 |
| `npm run dev:clean` | То же + очистка `.next` |
| `npm run db:migrate` | Схема SQLite |
| `npm run build` / `npm start` | Прод-сборка и запуск |
| `npm run desktop:dev` | UI десктопа (Vite, :1420) |
| `npm run desktop:tauri` | Нативное окно Tauri 2 |
| `npm run desktop:build` | Сборка десктоп-приложения |

Десктоп: `desktop/` — см. `desktop/README.md`. Стек: Tauri 2 + React + Vite. Темы: светлая / тёмная / системная + свои акценты.

## Env

Variables are read from `relay/.env.local` (see `.env.example`) — a copy in the repo root is ignored.
Minimum: `AUTH_SECRET` (32+ chars). Optional: `OPENAI_API_KEY`, `DATABASE_URL`, `GOOGLE_*` / `GITHUB_*` / `YANDEX_*` / `VK_*` OAuth, `CORS_ORIGINS`, `TRUST_PROXY`.

Desktop OAuth needs no OS registration: the app pairs via `/api/v1/auth/desktop/pair`, opens the
provider in the system browser and polls `/api/v1/auth/desktop/claim` (code + claimSecret). After editing OAuth env vars, restart `npm run dev`.

Desktop cloud: start API (`npm run dev`), then `npm run desktop:dev` with `VITE_API_URL=http://127.0.0.1:3000`.

## Conventions

- Server-only DB imports in Route Handlers / Server Components
- Zod at every API boundary
- Soft-delete pages (`deleted_at`); never hard-delete in MVP
- UI copy: short, human, no jargon in empty states

## Postgres migration path

Schema is intentionally close to SQL-portable types. To move to Neon: swap `src/db/client.ts` to `drizzle-orm/postgres-js`, adjust JSON columns, add `tsvector` search as in the original design.
