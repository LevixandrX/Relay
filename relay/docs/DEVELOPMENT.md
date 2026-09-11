# Development guide (for humans & AI agents)

## Repo root

Application lives in `relay/`. Parent repo may contain wrapper scripts.

## Before coding

1. Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and this file.
2. Any UI change: read `docs/DESIGN_PRINCIPLES.md` first. Prefer quieter, more native desktop — not AI-SaaS polish.
3. For Next.js APIs, prefer `node_modules/next/dist/docs/` over training data (see root `AGENTS.md`).
4. Keep changes tenant-safe: never fetch a page without membership join.

## Запуск (важно)

Рабочая папка приложения: **`relay/`**.

```bash
cd relay
npm run db:migrate
npm run dev          # сайт http://localhost:3000 (сам освобождает порт)
```

### Windows — один ярлык (веб + десктоп)

После клона с GitHub:

```powershell
# из корня репозитория
powershell -File scripts/setup-windows-dev.ps1
```

На рабочем столе появится **Relay.lnk** — API + браузер + окно десктопа (live UI через `tauri:dev`).

Переустановить только ярлык:

```powershell
cd relay
npm run relay:shortcut
```

Запуск вручную:

```powershell
cd relay
npm run relay:start
```

Заранее собранный `relay_desktop.exe` **вшивает** UI и **не** подхватывает Vite — для разработки используй ярлык / `relay:start`.

Опционально release-exe: `powershell -File scripts/start-desktop.ps1 -Rebuild`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Старт + авто-освобождение порта 3000 |
| `npm run dev:clean` | То же + очистка `.next` |
| `npm run db:migrate` | Схема SQLite |
| `npm run build` / `npm start` | Прод-сборка и запуск |
| `npm run relay:start` | Windows: API + браузер + десктоп |
| `npm run relay:shortcut` | Ярлык Relay.lnk на Desktop |
| `npm run desktop:dev` | UI десктопа (Vite, :1420) |
| `npm run desktop:tauri` | Нативное окно Tauri 2 |
| `npm run desktop:build` | Сборка десктоп-приложения |

Десктоп: `desktop/` — см. `desktop/README.md`. Стек: Tauri 2 + React + Vite.

Shared web modules are imported via aliases in `desktop/vite.aliases.mjs`. Vite does **not** read `tsconfig.json` paths — a missing entry there is a runtime failure. Keep that file in sync with `desktop/tsconfig.json` `compilerOptions.paths`.

## GitHub Releases (опционально)

Тег `v*` запускает CI и прикрепляет Windows `.exe`/`.msi` к Release — для тестеров без dev-окружения.  
Основной путь для команды: clone + `setup-windows-dev.ps1` + ярлык.

## Env

Variables are read from `relay/.env.local` (see `.env.example`).

Minimum: `AUTH_SECRET` (32+ chars). Optional: OAuth keys, `OPENAI_API_KEY`, `DATABASE_URL`, `CORS_ORIGINS`.

Desktop cloud: start API (`npm run dev`), then desktop with `VITE_API_URL=http://127.0.0.1:3000`.

## Conventions

- Server-only DB imports in Route Handlers / Server Components
- Zod at every API boundary
- Soft-delete pages (`deleted_at`)
- UI copy: short, human, no jargon in empty states
