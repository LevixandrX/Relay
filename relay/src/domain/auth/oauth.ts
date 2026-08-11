import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  memberships,
  oauthAccounts,
  userChecklist,
  users,
  workspaces,
} from "@/db/schema";
import { createTrialSubscription } from "@/domain/billing/entitlements";
import { id, now, slugify } from "@/lib/ids";
import { writeAudit } from "@/domain/audit";
import { createPage } from "@/domain/pages/repo";
import { paragraphs } from "@/domain/blocks/schema";

export const OAUTH_PROVIDERS = ["google", "github", "yandex", "vk"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export type OAuthClient = "web" | "desktop";

export function isOAuthProvider(v: unknown): v is OAuthProvider {
  return typeof v === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(v);
}

type OAuthState = {
  provider: OAuthProvider;
  client: OAuthClient;
  nonce: string;
  /** Desktop handshake code — token is handed over through the pairing table. */
  pair?: string;
};

type OAuthProfile = {
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET required (32+ chars)");
  return new TextEncoder().encode(s);
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function signOAuthState(state: OAuthState) {
  return new SignJWT(state as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function verifyOAuthState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!isOAuthProvider(payload.provider)) return null;
    const client = payload.client;
    if (client !== "web" && client !== "desktop") return null;
    return {
      provider: payload.provider,
      client,
      nonce: String(payload.nonce ?? ""),
      pair: typeof payload.pair === "string" ? payload.pair : undefined,
    };
  } catch {
    return null;
  }
}

export function oauthCallbackUrl(provider: OAuthProvider) {
  return `${appUrl()}/api/v1/auth/oauth/${provider}/callback`;
}

export function providerEnvPrefix(provider: OAuthProvider) {
  return provider.toUpperCase();
}

export function googleAuthUrl(state: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not set");
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", oauthCallbackUrl("google"));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("access_type", "online");
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export function githubAuthUrl(state: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error("GITHUB_CLIENT_ID not set");
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", oauthCallbackUrl("github"));
  u.searchParams.set("scope", "read:user user:email");
  u.searchParams.set("state", state);
  return u.toString();
}

export function yandexAuthUrl(state: string) {
  const clientId = process.env.YANDEX_CLIENT_ID;
  if (!clientId) throw new Error("YANDEX_CLIENT_ID not set");
  const u = new URL("https://oauth.yandex.ru/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", oauthCallbackUrl("yandex"));
  u.searchParams.set("state", state);
  u.searchParams.set("force_confirm", "yes");
  return u.toString();
}

export function vkAuthUrl(state: string) {
  const clientId = process.env.VK_CLIENT_ID;
  if (!clientId) throw new Error("VK_CLIENT_ID not set");
  const u = new URL("https://oauth.vk.com/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("display", "page");
  u.searchParams.set("redirect_uri", oauthCallbackUrl("vk"));
  u.searchParams.set("scope", "email");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("v", "5.199");
  u.searchParams.set("state", state);
  return u.toString();
}

export function authorizeUrl(provider: OAuthProvider, state: string) {
  switch (provider) {
    case "google":
      return googleAuthUrl(state);
    case "github":
      return githubAuthUrl(state);
    case "yandex":
      return yandexAuthUrl(state);
    case "vk":
      return vkAuthUrl(state);
  }
}

async function exchangeGoogle(code: string): Promise<OAuthProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: oauthCallbackUrl("google"),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error("GOOGLE_TOKEN_FAILED");
  const tokens = (await tokenRes.json()) as { access_token: string };
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error("GOOGLE_PROFILE_FAILED");
  const profile = (await profileRes.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!profile.email) throw new Error("GOOGLE_EMAIL_REQUIRED");
  if (profile.email_verified === false) throw new Error("GOOGLE_EMAIL_REQUIRED");
  return {
    providerUserId: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email.split("@")[0],
    avatarUrl: profile.picture ?? null,
  };
}

async function exchangeGithub(code: string): Promise<OAuthProfile> {
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: oauthCallbackUrl("github"),
    }),
  });
  if (!tokenRes.ok) throw new Error("GITHUB_TOKEN_FAILED");
  const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokens.access_token) throw new Error(tokens.error || "GITHUB_TOKEN_FAILED");

  const profileRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Relay",
    },
  });
  if (!profileRes.ok) throw new Error("GITHUB_PROFILE_FAILED");
  const profile = (await profileRes.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string;
  };

  const emailsRes = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Relay",
    },
  });
  if (!emailsRes.ok) throw new Error("GITHUB_EMAIL_REQUIRED");
  const emails = (await emailsRes.json()) as {
    email: string;
    primary: boolean;
    verified: boolean;
  }[];
  const primary =
    emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
  const email = primary?.email.toLowerCase() ?? null;
  if (!email) throw new Error("GITHUB_EMAIL_REQUIRED");

  return {
    providerUserId: String(profile.id),
    email,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url ?? null,
  };
}

async function exchangeYandex(code: string): Promise<OAuthProfile> {
  const clientId = process.env.YANDEX_CLIENT_ID!;
  const clientSecret = process.env.YANDEX_CLIENT_SECRET!;
  const tokenRes = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenRes.ok) throw new Error("YANDEX_TOKEN_FAILED");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("YANDEX_TOKEN_FAILED");

  const profileRes = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error("YANDEX_PROFILE_FAILED");
  const profile = (await profileRes.json()) as {
    id: string;
    login?: string;
    default_email?: string;
    emails?: string[];
    real_name?: string;
    display_name?: string;
    default_avatar_id?: string;
    is_avatar_empty?: boolean;
  };

  const email = (profile.default_email || profile.emails?.[0] || "").toLowerCase();
  if (!email) throw new Error("YANDEX_EMAIL_REQUIRED");

  const avatarUrl =
    profile.default_avatar_id && !profile.is_avatar_empty
      ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
      : null;

  return {
    providerUserId: String(profile.id),
    email,
    name: profile.real_name || profile.display_name || profile.login || email.split("@")[0],
    avatarUrl,
  };
}

async function exchangeVk(code: string): Promise<OAuthProfile> {
  const clientId = process.env.VK_CLIENT_ID!;
  const clientSecret = process.env.VK_CLIENT_SECRET!;
  const tokenUrl = new URL("https://oauth.vk.com/access_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("redirect_uri", oauthCallbackUrl("vk"));
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) throw new Error("VK_TOKEN_FAILED");
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    user_id?: number;
    email?: string;
    error?: string;
  };
  if (!tokens.access_token || !tokens.user_id) {
    throw new Error(tokens.error || "VK_TOKEN_FAILED");
  }
  if (!tokens.email) throw new Error("VK_EMAIL_REQUIRED");

  const profileUrl = new URL("https://api.vk.com/method/users.get");
  profileUrl.searchParams.set("user_ids", String(tokens.user_id));
  profileUrl.searchParams.set("fields", "photo_200");
  profileUrl.searchParams.set("access_token", tokens.access_token);
  profileUrl.searchParams.set("v", "5.199");

  const profileRes = await fetch(profileUrl);
  if (!profileRes.ok) throw new Error("VK_PROFILE_FAILED");
  const body = (await profileRes.json()) as {
    response?: { id: number; first_name?: string; last_name?: string; photo_200?: string }[];
    error?: { error_msg?: string };
  };
  const profile = body.response?.[0];
  if (!profile) throw new Error(body.error?.error_msg || "VK_PROFILE_FAILED");

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return {
    providerUserId: String(profile.id),
    email: tokens.email.toLowerCase(),
    name: name || tokens.email.split("@")[0],
    avatarUrl: profile.photo_200 ?? null,
  };
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string) {
  switch (provider) {
    case "google":
      return exchangeGoogle(code);
    case "github":
      return exchangeGithub(code);
    case "yandex":
      return exchangeYandex(code);
    case "vk":
      return exchangeVk(code);
  }
}

function hasPassword(hash: string | null | undefined) {
  return !!hash && hash.length >= 20;
}

async function createUserFromOAuth(input: {
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: OAuthProvider;
  providerUserId: string;
}) {
  const userId = id.user();
  const ts = now();
  await db.insert(users).values({
    id: userId,
    email: input.email,
    passwordHash: "",
    name: input.name,
    avatarUrl: input.avatarUrl,
    onboardingIntent: "write",
    createdAt: ts,
  });
  await db.insert(userChecklist).values({
    userId,
    editedPage: false,
    usedSlashOrPrompt: false,
    openedShare: false,
    dismissed: false,
    updatedAt: ts,
  });
  await createTrialSubscription(userId);

  const wsId = id.workspace();
  await db.insert(workspaces).values({
    id: wsId,
    name: "Моё пространство",
    slug: slugify("Моё пространство"),
    createdBy: userId,
    createdAt: ts,
  });
  await db.insert(memberships).values({
    id: id.membership(),
    workspaceId: wsId,
    userId,
    role: "owner",
    createdAt: ts,
  });
  await createPage({
    userId,
    workspaceId: wsId,
    title: "С чего начать",
    content: paragraphs(
      "Добро пожаловать в Relay.",
      "Пиши здесь или переключись на холст пространства.",
    ),
    position: 1000,
  });
  await writeAudit({
    workspaceId: wsId,
    actorId: userId,
    action: "workspace.create",
    targetType: "workspace",
    targetId: wsId,
  });

  await db.insert(oauthAccounts).values({
    id: `oa_${id.token().slice(0, 16)}`,
    userId,
    provider: input.provider,
    providerUserId: input.providerUserId,
    email: input.email,
    createdAt: ts,
  });

  return userId;
}

/**
 * Link by provider uid, or create a new user.
 * Never silently attach OAuth to an existing password account (pre-account hijack).
 * OAuth-only accounts (empty password) may gain additional providers by email.
 */
export async function upsertOAuthUser(input: {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}) {
  const linked = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, input.provider),
        eq(oauthAccounts.providerUserId, input.providerUserId),
      ),
    )
    .limit(1);

  if (linked[0]) return linked[0].userId;

  const byEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (byEmail[0]) {
    if (hasPassword(byEmail[0].passwordHash)) {
      throw new Error("EMAIL_CONFLICT");
    }
    await db.insert(oauthAccounts).values({
      id: `oa_${id.token().slice(0, 16)}`,
      userId: byEmail[0].id,
      provider: input.provider,
      providerUserId: input.providerUserId,
      email: input.email,
      createdAt: now(),
    });
    if (input.avatarUrl && !byEmail[0].avatarUrl) {
      await db
        .update(users)
        .set({ avatarUrl: input.avatarUrl })
        .where(eq(users.id, byEmail[0].id));
    }
    return byEmail[0].id;
  }

  return createUserFromOAuth(input);
}

export function desktopDoneUrl(provider: OAuthProvider, status: "ok" | "expired" | "nopair") {
  return `${appUrl()}/auth/desktop?provider=${provider}&status=${status}`;
}

export function finishRedirect(opts: {
  client: OAuthClient;
  provider: OAuthProvider;
  pairRequested: boolean;
  paired: boolean;
}) {
  if (opts.client === "desktop") {
    if (opts.pairRequested) {
      return desktopDoneUrl(opts.provider, opts.paired ? "ok" : "expired");
    }
    // Never put JWT in a URL / deep link — pairing is required for desktop.
    return desktopDoneUrl(opts.provider, "nopair");
  }
  return `${appUrl()}/app`;
}

export function hashClaimSecret(secretPlain: string) {
  return createHash("sha256").update(secretPlain).digest("hex");
}

export function newClaimSecret() {
  return randomBytes(32).toString("base64url");
}
