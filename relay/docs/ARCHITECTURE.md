# Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js 16 App Router + TypeScript | Route Handlers under `/api/v1` |
| UI | React 19 + Tailwind CSS 4 | Design tokens in `globals.css` |
| Editor | TipTap (ProseMirror) | Document stored as JSON AST |
| DB | LibSQL (local file) via Drizzle | Swap to Neon Postgres later with same schema shape |
| Auth | Custom `jose` JWT (cookie **or** Bearer) | Email/password + Google/GitHub OAuth; desktop uses Bearer |
| Billing | `subscriptions` + entitlements | 14-day Pro trial; Stripe later |
| Validation | Zod | Shared for API + document AST |

## Multi-tenancy

Shared tables, `workspace_id` on every domain row. Access is enforced in **repositories** via membership joins — handlers must not query pages by id alone.

## Request path

```
Browser → Route Handler → requireSession / requireWorkspaceAccess
       → domain repo (tenant-scoped) → LibSQL
       → optional audit_logs write (same logical unit)
```

## Key modules

```
src/
  app/                 # routes + UI
  db/                  # drizzle schema + client + migrate
  domain/
    access.ts          # RBAC
    blocks/            # AST schema + serializers
    pages/             # page repo + search
    workspaces/        # workspace + memberships
    prompts/           # Live Prompt runners
    onboarding/        # intent templates + checklist
  editor/              # TipTap extensions + Editor component
  lib/                 # session, errors, ids, rate-limit (in-memory)
  components/          # UI chrome, onboarding, pulse
```

## Environments

- Local: `file:./data/relay.db` (LibSQL)
- Prod target: Neon Postgres + Vercel (migration path documented in DEVELOPMENT.md)

## Security baseline

- Session cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production
- IDOR: missing membership → **404** (not 403)
- Document AST validated with Zod whitelist before persist
- Embeds: hostname allowlist only
- Rate limit: in-memory Map (swap to Upstash in prod)
