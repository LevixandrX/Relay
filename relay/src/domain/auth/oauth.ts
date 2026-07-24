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

export type OAuthProvider = "google" | "github";
export type OAuthClient = "web" | "desktop";

type OAuthState = {
  provider: OAuthProvider;
  client: OAuthClient;
  nonce: string;
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET required");
  return new TextEncoder().encode(s);
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function desktopDeepLink() {
  return process.env.DESKTOP_DEEP_LINK || "relay://auth";
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
    const provider = payload.provider;
    const client = payload.client;
    if (provider !== "google" && provider !== "github") return null;
    if (client !== "web" && client !== "desktop") return null;
    return {
      provider,
      client,
      nonce: String(payload.nonce ?? ""),
    };
  } catch {
    return null;
  }
}

export function oauthCallbackUrl(provider: OAuthProvider) {
  return `${appUrl()}/api/v1/auth/oauth/${provider}/callback`;
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

async function exchangeGoogle(code: string) {
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
    name?: string;
    picture?: string;
  };
  if (!profile.email) throw new Error("GOOGLE_EMAIL_REQUIRED");
  return {
    providerUserId: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email.split("@")[0],
    avatarUrl: profile.picture ?? null,
  };
}

async function exchangeGithub(code: string) {
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
    email?: string | null;
    avatar_url?: string;
  };

  let email = profile.email?.toLowerCase() ?? null;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Relay",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      const primary =
        emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
      email = primary?.email.toLowerCase() ?? null;
    }
  }
  if (!email) throw new Error("GITHUB_EMAIL_REQUIRED");

  return {
    providerUserId: String(profile.id),
    email,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url ?? null,
  };
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string) {
  return provider === "google" ? exchangeGoogle(code) : exchangeGithub(code);
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
    passwordHash: "", // OAuth-only; empty = no password login
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

export function finishRedirect(opts: {
  client: OAuthClient;
  accessToken: string;
}) {
  if (opts.client === "desktop") {
    const base = desktopDeepLink();
    return `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(opts.accessToken)}`;
  }
  return `${appUrl()}/app?token=${encodeURIComponent(opts.accessToken)}`;
}
