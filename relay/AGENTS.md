# Relay — agent entrypoint

**Relay** — Notion-like SaaS: workspaces, pages (TipTap), infinite canvas (tldraw), web + Tauri desktop.

## Read first (обязательно)

1. **[docs/SPEC.md](docs/SPEC.md)** — ТЗ, что сделано, стек, **запреты архитектуры**
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — границы модулей
3. [docs/PRODUCT.md](docs/PRODUCT.md) — продукт
4. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — как запускать
5. [docs/API.md](docs/API.md) — контракт API при изменении эндпоинтов

## Backend & DB (коротко)

- **Сетевой бэкенд:** Next.js 16 Route Handlers (`/api/v1`), TypeScript — **не** отдельный сервис  
- **БД:** LibSQL (файл) + Drizzle; прод-цель — Postgres той же формы схемы  

## Non-negotiables

- Не нарушать границы `domain/` / RBAC / `/api/v1`  
- Не класть JWT в URL  
- Не коммитить секреты; env только `relay/.env.local`  
- Не «упрощать архитектуру» ради быстрого фикса — обновить SPEC или спросить  
- Перед кодом Next.js — смотреть `node_modules/next/dist/docs/` (ломающие изменения)

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
