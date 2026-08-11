import { SignJWT, jwtVerify } from "jose";
import { and, eq, isNull, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { ApiError } from "@/lib/errors";
import { id, now } from "@/lib/ids";

async function findUser(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export const SESSION_COOKIE = "relay_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 14; // 14 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set (32+ chars)");
  }
  return new TextEncoder().encode(s);
}

async function pruneExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, now()));
}

export async function createSessionToken(userId: string) {
  await pruneExpiredSessions();
  const jti = `ses_${id.token()}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString();
  await db.insert(sessions).values({
    id: jti,
    userId,
    expiresAt,
    createdAt: now(),
  });
  return new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const jti = typeof payload.jti === "string" ? payload.jti : null;
    if (!userId || !jti) return null;

    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, jti), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt < now()) {
      await db.delete(sessions).where(eq(sessions.id, jti));
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

export async function revokeSessionToken(token: string | null | undefined) {
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, secret());
    const jti = typeof payload.jti === "string" ? payload.jti : null;
    if (!jti) return;
    await db.update(sessions).set({ revokedAt: now() }).where(eq(sessions.id, jti));
  } catch {
    // ignore invalid tokens on logout
  }
}

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return token;
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await revokeSessionToken(token);
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const bearer = auth.slice(7).trim();
    if (bearer) {
      const fromBearer = await verifySessionToken(bearer);
      if (fromBearer) return fromBearer;
    }
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession() {
  const userId = await getSessionUserId();
  if (!userId) throw new ApiError(401, "unauthorized", "Sign in required");
  const user = await findUser(userId);
  if (!user) throw new ApiError(401, "unauthorized", "Sign in required");
  return user;
}
