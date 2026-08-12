# Architecture

> Полное ТЗ и запреты: **[SPEC.md](./SPEC.md)**. Этот файл — краткая карта стека и границ.

## Stack (сетевой бэкенд и БД)

| Layer | Choice | Notes |
|---|---|---|
| **Backend (HTTP API)** | **Next.js 16** App Router, TypeScript | Route Handlers `/api/v1/*` — отдельного сервиса нет |
| **Database** | **LibSQL** (file) + **Drizzle ORM** | Локально `file:./data/relay.db`; позже Neon Postgres |
| Web UI | React 19 + CSS tokens (`globals.css`) + next-intl (ru/en) | |
| Desktop | Tauri 2 + React/Vite | Тот же API по HTTP + Bearer; те же `messages/*.json` |
| Editor | TipTap (ProseMirror) | Документ = JSON AST |
| Canvas | tldraw | Snapshot в JSON (workspace/page `board`) |
| Auth | `jose` JWT + таблица `sessions` | Cookie (web) или `Authorization: Bearer` (desktop) |
| Billing | `subscriptions` + entitlements | Free / Pro trial 14d |
| Validation | Zod | API + document AST |

## Request path

```
Browser / Tauri
  → /api/v1/...
  → requireSession / requireWorkspaceAccess
  → domain/* (tenant-scoped)
  → Drizzle → LibSQL
  → optional audit_logs
```

## Module boundaries

```
src/
  app/           # тонкие routes + UI pages — без тяжёлой бизнес-логики
  domain/        # auth, access, pages, workspaces, billing, prompts
  db/            # schema + migrate + client
  editor/        # TipTap
  lib/           # session, cors, errors, rate-limit, ids
  components/    # UI chrome
desktop/         # shell; cloud через API; guest — local store
```

**Правило:** логика «можно ли?» и «как сохранить?» живёт в `domain/`, не в кнопках.

## Multi-tenancy

На доменных строках есть `workspace_id`. Доступ только через membership join.  
Нет membership → **404** (не светим существование ресурса).

## Auth sketch

- Web: HttpOnly cookie `relay_session`
- Desktop: Bearer после login / OAuth pairing
- JWT содержит `sub` + `jti`; строка в `sessions`; logout → `revoked_at`
- OAuth providers: google, github, yandex (vk отложен)

## Security baseline

См. SPEC §3–4. Кратко: RBAC, отзываемые сессии, CORS allowlist, no JWT-in-URL, claimSecret для desktop pair, CSP в Tauri.

## Environments & evolution

- Local DB: LibSQL file  
- Prod DB: **не зафиксирована** (Postgres — кандидат; выбор после MVP, см. SPEC §1.1)  
- **Не тащить Redis/микросервисы по умолчанию.** Сначала закрыть MVP на текущем стеке, потом эволюция слоёв целиком.
