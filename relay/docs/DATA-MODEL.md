# Data model

SQLite / LibSQL tables (Drizzle). IDs are `text` (nanoid). Timestamps are ISO strings.

## Tables

### users
`id`, `email` (unique), `password_hash`, `name`, `avatar_url?`, `onboarding_intent?`, `onboarding_completed_at?`, `created_at`

### workspaces
`id`, `name`, `slug` (unique), `board?` (workspace canvas JSON), `created_by`, `created_at`, `deleted_at?`

### memberships
`id`, `workspace_id`, `user_id`, `role` (`owner`|`editor`|`viewer`), `created_at`
Unique `(workspace_id, user_id)`

### invites
`id`, `workspace_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at?`, `created_at`

### pages
`id`, `workspace_id`, `parent_page_id?`, `title`, `icon?`, `position` (real, fractional index),
`content` (JSON text — ProseMirror doc), `board?` (Quickdraw snapshot JSON), `plain_text` (denormalized for search),
`public_id?` (set when published), `created_by`, `created_at`, `updated_at`, `deleted_at?`

### page_revisions
`id`, `page_id`, `workspace_id`, `title`, `content`, `board?` (empty string = no board; NULL on old rows = board not captured), `created_by`, `created_at`

Snapshots are taken of the **previous** state when a page is saved: at most every ~10 minutes, or after a 90s pause if text/board actually changed. Restore writes a forced snapshot of the current page first.

### workspace_revisions
`id`, `workspace_id`, `board`, `created_by`, `created_at` — same cadence as page board snapshots.

### audit_logs
`id`, `workspace_id`, `actor_id?`, `action`, `target_type?`, `target_id?`, `meta` (JSON), `created_at`

### user_checklist
`user_id` PK, `edited_page`, `used_slash_or_prompt`, `opened_share`, `dismissed`, `updated_at`

## Content format

`pages.content` is a TipTap/ProseMirror JSON document:

```json
{ "type": "doc", "content": [ /* block nodes */ ] }
```

Block types: `paragraph`, `heading`, `bulletList`, `orderedList`, `taskList`, `codeBlock`, `blockquote`, `horizontalRule`, `callout`, `promptBlock`, `image`, `embed`.

See `src/domain/blocks/schema.ts`.
