import "dotenv/config";
import { client } from "./client";

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    onboarding_intent TEXT,
    onboarding_completed_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS oauth_provider_uid ON oauth_accounts(provider, provider_user_id)`,
  `CREATE TABLE IF NOT EXISTS auth_pairings (
    code TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    claim_secret_hash TEXT NOT NULL DEFAULT '',
    access_token TEXT,
    error TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    trial_ends_at TEXT,
    current_period_end TEXT,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    board TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS memberships_ws_user ON memberships(workspace_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    parent_page_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    icon TEXT,
    position REAL NOT NULL DEFAULT 1000,
    content TEXT NOT NULL,
    board TEXT,
    plain_text TEXT NOT NULL DEFAULT '',
    public_id TEXT UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS pages_ws_parent ON pages(workspace_id, parent_page_id, position)`,
  `CREATE TABLE IF NOT EXISTS page_revisions (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES pages(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    actor_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    meta TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS audit_ws_created ON audit_logs(workspace_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS user_checklist (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    edited_page INTEGER NOT NULL DEFAULT 0,
    used_slash_or_prompt INTEGER NOT NULL DEFAULT 0,
    opened_share INTEGER NOT NULL DEFAULT 0,
    dismissed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,
];

const softAlters = [
  `ALTER TABLE workspaces ADD COLUMN board TEXT`,
  `ALTER TABLE pages ADD COLUMN board TEXT`,
  `ALTER TABLE auth_pairings ADD COLUMN claim_secret_hash TEXT NOT NULL DEFAULT ''`,
];

async function migrate() {
  for (const sql of statements) {
    await client.execute(sql);
  }
  for (const sql of softAlters) {
    try {
      await client.execute(sql);
    } catch {
      // колонка уже есть
    }
  }

  // Drop leftover pairings from before claim-secret hardening — they are unsafe to claim.
  await client.execute(`DELETE FROM auth_pairings WHERE claim_secret_hash = '' OR claim_secret_hash IS NULL`);

  // Backfill subscriptions for existing users
  await client.execute(`
    INSERT OR IGNORE INTO subscriptions (user_id, plan, status, trial_ends_at, updated_at, created_at)
    SELECT id, 'pro', 'trialing',
      datetime('now', '+14 days'),
      datetime('now'),
      created_at
    FROM users
  `);

  console.log("Relay DB migrated.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
