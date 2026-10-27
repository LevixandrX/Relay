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
| GET | `/auth/me` | user (incl. `providers`, `hasPassword`, `avatarUrl`) + workspaces + checklist + **subscription** |
| PATCH | `/auth/me` | `{ name?, avatarUrl? }` — `avatarUrl: null` clears |
| DELETE | `/auth/me/providers/:provider` | unlink Google/GitHub/Yandex; refused if last login method |
| GET | `/auth/oauth/google?client=web\|desktop&intent=link?` | start Google OAuth; `intent=link` requires session |
| GET | `/auth/oauth/google/callback` | |
| GET | `/auth/oauth/github?client=web\|desktop` | start GitHub OAuth |
| GET | `/auth/oauth/github/callback` | |
| GET | `/auth/oauth/yandex?client=web\|desktop` | start Yandex OAuth |
| GET | `/auth/oauth/yandex/callback` | |
| GET | `/auth/oauth/vk?client=web\|desktop` | start VK OAuth |
| GET | `/auth/oauth/vk/callback` | |
| POST | `/auth/desktop/pair` | `{ provider, intent?: "login"\|"link" }` → `{ code, claimSecret, url }` — `intent=link` needs Bearer |
| POST | `/auth/desktop/claim` | `{ code, claimSecret }` → `{ status: pending \| ready \| error \| expired }`, token returned once |

OAuth callback sets the session cookie, then redirects: web → `/app`, desktop → `/auth/desktop?status=…`
(the app picks the token up via `/auth/desktop/claim` with the claimSecret). Handshake rows live in `auth_pairings` for 10 minutes.
JWT is never placed in URLs or deep links.

## Locale (web UI)

| Method | Path | Notes |
|---|---|---|
| POST | `/locale` | `{ locale: "ru" \| "en" }` → sets cookie `relay-locale` (1 year). No auth required. Without cookie, UI locale follows `Accept-Language` (`ru*` → ru, else en). |

## Workspaces

| Method | Path |
|---|---|
| GET | `/workspaces` | includes `memberCount`, `ownerName` |
| POST | `/workspaces` `{ name }` | gated by plan |
| PATCH | `/workspaces/:wid` `{ name }` | owner; rename |
| GET | `/workspaces/:wid/members` |
| POST | `/workspaces/:wid/invites` `{ email, role }` | owner; gated by member limit |
| GET/PUT | `/workspaces/:wid/board` | workspace canvas |
| GET | `/workspaces/:wid/board/revisions` | grouped session diffs, no raw snapshots |
| GET | `/workspaces/:wid/board/revisions/:rid` | |
| POST | `/workspaces/:wid/board/revisions/:rid/restore` | |

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
| GET | `/pages/:id/revisions` | grouped session diffs (text + board), no raw snapshots |
| GET | `/pages/:id/revisions/:rid` | snapshot: title + content + board |
| POST | `/pages/:id/revisions/:rid/restore` | write; snapshots current first |
| POST | `/pages/:id/publish` | plan limit |
| DELETE | `/pages/:id/publish` |
| POST | `/pages/:id/run-prompt` | Live Prompt `{ prompt, mode? }` |

## Search & activity

| Method | Path |
|---|---|
| GET | `/workspaces/:wid/search?q=` |
| GET | `/workspaces/:wid/pulse` | recent audit events; `?pageId=` scopes to that page |
| GET | `/workspaces/:wid/activity` | recent edit sessions across pages and the workspace board |
| GET | `/workspaces/:wid/analytics` | `range` is `7d`, `30d`, `90d`, or `all`; `pageId` scopes to one page |
| POST | `/workspaces/:wid/views` `{ pageId }` | record a view; `pageId: null` is the workspace board |

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

## Block comments

- `GET /pages/:id/comments` returns threads, messages, reaction counts, file metadata, workspace mention choices, workspace custom emoji, and the current author. Access requires page membership. Resolved discussions are retained.
- `POST /pages/:id/comments` accepts the discriminated `action`: `create`, `reply`, `edit`, `deleteMessage`, `resolve`, `react`, `unread`, `mute`, or `createEmoji`. Content changes require owner/editor; viewers may read and update their own read/mute state. Only the author edits a message; the workspace owner may also delete it.
- `GET /pages/:id/comments?fileId=:fileId` returns an attachment's base64 payload after checking its thread belongs to this page. Files have no public URL.
- `GET /pages/:id/comments?previewPage=:linkedPageId` returns a short page preview within the same workspace.
- `GET /pages/:id/comments?blockActivity=:blockId` returns the saved creator/editor names and timestamps, or `null` if no block activity has been recorded yet. Page membership is checked before looking up the block. Moving an unchanged block preserves its last editor. Older content starts recording metadata on its next meaningful edit; historical authors are not inferred.
- `create` / `reply` accept `dates` (up to 30 valid ISO calendar dates) alongside member mentions and page IDs. The shared composer inserts all three through the same `@` menu.
- `createEmoji` accepts `{ name, data, type: "image/png" }`: a unique workspace name of 1–40 letters/numbers/underscore/hyphen and a base64 PNG up to 32 KiB and 64×64 pixels. Owner/editor permission is required. Limit: 64 custom emoji/workspace. `react.emoji` accepts catalog Unicode emoji or `custom:<uuid>` belonging to this workspace.
- Limit: 200 threads/page, 100 messages/thread, 10,000 characters/message, 3 attachments/message of up to 2 MiB each, and 20 MiB attachments/page. Request bodies are bounded to 9 MiB, including chunked requests.
- Anchors use stable `blockId` values in document attributes. Block movement/conversion preserves IDs; duplication creates new IDs. Deleted anchors keep their discussion in the comments list. Comments are stored independently from page revisions.
- Mentions refer to workspace members; page links are validated within that workspace. Muting hides the local unread indicator for that discussion. Updates are polled while the app is visible; this does not send email or push notifications.
- Desktop cloud uses this same API with Bearer auth. Desktop guest discussions are persisted locally.
- Comment people/authors include their current workspace `role` when they are members. Hover cards do not infer other people's time zones or roles.

After pulling this change, run `npm run db:migrate` before starting the API.
Check comment storage and authorization with `node node_modules/tsx/dist/cli.mjs tests/comments-domain.ts` (uses an isolated temporary DB).

## Text layout

Page content accepts `columns` (2–500 `column` children, matching the document's per-node child limit), with each column containing blocks and a positive relative `width` (0.01–100). Resize previews update at display cadence and commit once on release, keeping widths within the same API bounds and producing one undo step. `blockIndent` is an integer from 0 to 8, rendered in 24px steps. Web, desktop and public pages share these layout semantics. Moves and resizing preserve block IDs and save through the existing page endpoint.

`columns.attrs.layoutStart` / `layoutEnd` optionally store outer row edges as workspace fractions from 0 to 1; `null` follows the normal text edge. When both exist, start must be less than end. Rendering enforces a readable minimum width and bounds the row to its workspace. Column rows and individual columns have stable block IDs and may own discussions, colors and block selections.
