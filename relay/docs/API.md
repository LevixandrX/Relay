# API (REST `/api/v1`)

Auth via session cookie `relay_session` **or** `Authorization: Bearer <jwt>`.  
JSON request/response. Errors: `{ "error": "code", "message": "..." }` (402 `plan_limit` for freemium).

CORS: origins from `CORS_ORIGINS` (desktop Vite `:1420` included by default).

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{ email, password, name, intent? }` → `{ …, accessToken }` + cookie; starts **14-day Pro trial** |
| POST | `/auth/login` | `{ email, password }` → `{ …, accessToken }` |
| POST | `/auth/logout` | |
| GET | `/auth/me` | user + workspaces + checklist + **subscription** |
| GET | `/auth/oauth/google?client=web\|desktop` | start Google OAuth |
| GET | `/auth/oauth/google/callback` | |
| GET | `/auth/oauth/github?client=web\|desktop` | start GitHub OAuth |
| GET | `/auth/oauth/github/callback` | |
| GET | `/auth/oauth/yandex?client=web\|desktop` | start Yandex OAuth |
| GET | `/auth/oauth/yandex/callback` | |
| GET | `/auth/oauth/vk?client=web\|desktop` | start VK OAuth |
| GET | `/auth/oauth/vk/callback` | |
| POST | `/auth/desktop/pair` | `{ provider }` → `{ code, claimSecret, url }` — one-time handshake for the desktop app |
| POST | `/auth/desktop/claim` | `{ code, claimSecret }` → `{ status: pending \| ready \| error \| expired }`, token returned once |

OAuth callback sets the session cookie, then redirects: web → `/app`, desktop → `/auth/desktop?status=…`
(the app picks the token up via `/auth/desktop/claim` with the claimSecret). Handshake rows live in `auth_pairings` for 10 minutes.
JWT is never placed in URLs or deep links.

## Workspaces

| Method | Path |
|---|---|
| GET | `/workspaces` |
| POST | `/workspaces` `{ name }` | gated by plan |
| GET | `/workspaces/:wid/members` |
| POST | `/workspaces/:wid/invites` `{ email, role }` | owner; gated by member limit |
| GET/PUT | `/workspaces/:wid/board` | workspace canvas |

## Invites

| Method | Path |
|---|---|
| POST | `/invites/accept` `{ token }` | must be signed in as invite email |
| Web UI | `/invite/[token]` | |

## Pages

| Method | Path |
|---|---|
| GET | `/workspaces/:wid/pages` | tree for sidebar |
| POST | `/workspaces/:wid/pages` | `{ parentPageId?, title? }` · plan limit |
| GET | `/pages/:id` |
| PATCH | `/pages/:id` | `{ title?, content?, board?, icon?, baseUpdatedAt }` |
| DELETE | `/pages/:id` | soft delete |
| POST | `/pages/:id/publish` | plan limit |
| DELETE | `/pages/:id/publish` |
| POST | `/pages/:id/run-prompt` | Live Prompt `{ prompt, mode? }` |

## Search & activity

| Method | Path |
|---|---|
| GET | `/workspaces/:wid/search?q=` |
| GET | `/workspaces/:wid/pulse` | recent audit events |

## Public

| Method | Path |
|---|---|
| GET | `/public/:publicId` | read-only page JSON (no auth) |

## Entitlements (foundation)

| Plan | Workspaces | Pages/ws | Members | Publish |
|---|---|---|---|---|
| Free (after trial) | 1 | 20 | 3 | 1 |
| Pro / trialing | 50 | 10k | 100 | 10k |

Stripe Checkout — next step; schema is `subscriptions`.

## Onboarding

| Method | Path |
|---|---|
| PATCH | `/me/checklist` | `{ key: "edited_page" \| … }` |
