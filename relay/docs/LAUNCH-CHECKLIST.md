# Launch checklist

- [ ] `npm run db:migrate` succeeds; `data/relay.db` created
- [ ] Register → land on Getting started with Live Prompt
- [ ] Edit page → Saved indicator; checklist “Edit” completes
- [ ] Slash `/` inserts callout / prompt; checklist updates
- [ ] Run Live Prompt offline (no OPENAI_API_KEY) → blocks inserted
- [ ] Compass ⌘K finds text inside page body
- [ ] Publish public link → `/p/:publicId` readable logged out
- [ ] Viewer role cannot PATCH (403) when tested via API
- [ ] Foreign page id returns 404 without membership
- [ ] Pulse shows recent create/update/publish/prompt events
- [ ] Sentry / structured logs (prod)
- [ ] Backup strategy for DB (file copy locally; Neon PITR in prod)
- [ ] `AUTH_SECRET` rotated for production
- [ ] Docs in `docs/` match shipped API/schema
