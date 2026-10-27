import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** null/empty for OAuth-only accounts */
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  onboardingIntent: text("onboarding_intent"),
  onboardingCompletedAt: text("onboarding_completed_at"),
  createdAt: text("created_at").notNull(),
});

/** Server-side session rows — JWT carries `jti`, logout sets revoked_at. */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // jti
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull(),
});

export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(), // google | github
    providerUserId: text("provider_user_id").notNull(),
    email: text("email"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("oauth_provider_uid").on(t.provider, t.providerUserId)],
);

/** Short-lived handshake rows used by the desktop app to pick up a token after browser OAuth. */
export const authPairings = sqliteTable("auth_pairings", {
  code: text("code").primaryKey(),
  provider: text("provider").notNull(), // google | github | yandex | vk
  /** SHA-256 of the claim secret returned only to the desktop app that started the flow. */
  claimSecretHash: text("claim_secret_hash").notNull(),
  accessToken: text("access_token"),
  error: text("error"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  plan: text("plan").notNull().default("free"), // free | pro
  status: text("status").notNull().default("active"), // active | trialing | canceled | past_due
  trialEndsAt: text("trial_ends_at"),
  currentPeriodEnd: text("current_period_end"),
  updatedAt: text("updated_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  board: text("board"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("memberships_ws_user").on(t.workspaceId, t.userId)],
);

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull(),
});

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  parentPageId: text("parent_page_id"),
  title: text("title").notNull().default(""),
  icon: text("icon"),
  position: real("position").notNull().default(1000),
  content: text("content").notNull(),
  board: text("board"),
  plainText: text("plain_text").notNull().default(""),
  publicId: text("public_id").unique(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const pageRevisions = sqliteTable("page_revisions", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  board: text("board"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const workspaceRevisions = sqliteTable("workspace_revisions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  board: text("board").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const contentViews = sqliteTable("content_views", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  /** null = the workspace board */
  pageId: text("page_id"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  meta: text("meta"),
  createdAt: text("created_at").notNull(),
});

export const userChecklist = sqliteTable("user_checklist", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  editedPage: integer("edited_page", { mode: "boolean" }).notNull().default(false),
  usedSlashOrPrompt: integer("used_slash_or_prompt", { mode: "boolean" })
    .notNull()
    .default(false),
  openedShare: integer("opened_share", { mode: "boolean" }).notNull().default(false),
  dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Role = "owner" | "editor" | "viewer";
export type PlanId = "free" | "pro";
export type SubStatus = "active" | "trialing" | "canceled" | "past_due";

/** Comments are independent of document revisions and scoped through the page's membership. */
export const commentThreads = sqliteTable("comment_threads", {
  id: text("id").primaryKey(), pageId: text("page_id").notNull().references(() => pages.id),
  blockId: text("block_id").notNull(), quote: text("quote").notNull(), anchorOffset: integer("anchor_offset"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(), threadId: text("thread_id").notNull().references(() => commentThreads.id),
  authorId: text("author_id").notNull().references(() => users.id), body: text("body").notNull(),
  mentions: text("mentions").notNull().default("[]"), pageLinks: text("page_links").notNull().default("[]"),
  createdAt: text("created_at").notNull(), editedAt: text("edited_at"), dates: text("dates").notNull().default("[]"),
});
export const commentFiles = sqliteTable("comment_files", {
  id: text("id").primaryKey(), commentId: text("comment_id").notNull().references(() => comments.id),
  name: text("name").notNull(), type: text("type").notNull(), size: integer("size").notNull(), data: text("data").notNull(),
});
export const commentReactions = sqliteTable("comment_reactions", {
  id: text("id").primaryKey(), commentId: text("comment_id").notNull().references(() => comments.id),
  userId: text("user_id").notNull().references(() => users.id), emoji: text("emoji").notNull(),
}, (t) => [uniqueIndex("comment_reaction_user").on(t.commentId, t.userId, t.emoji)]);
export const commentStates = sqliteTable("comment_states", {
  id: text("id").primaryKey(), threadId: text("thread_id").notNull().references(() => commentThreads.id),
  userId: text("user_id").notNull().references(() => users.id), readAt: text("read_at"),
  muted: integer("muted", { mode: "boolean" }).notNull().default(false),
}, (t) => [uniqueIndex("comment_state_user").on(t.threadId, t.userId)]);

export const customEmojis = sqliteTable("custom_emojis", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(), data: text("data").notNull(), type: text("type").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id), createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("custom_emoji_name").on(t.workspaceId, t.name)]);
export const blockActivity = sqliteTable("block_activity", {
  id: text("id").primaryKey(), pageId: text("page_id").notNull().references(() => pages.id), blockId: text("block_id").notNull(),
  createdBy: text("created_by").references(() => users.id), createdAt: text("created_at"),
  editedBy: text("edited_by").notNull().references(() => users.id), editedAt: text("edited_at").notNull(),
}, (t) => [uniqueIndex("block_activity_page").on(t.pageId, t.blockId)]);
