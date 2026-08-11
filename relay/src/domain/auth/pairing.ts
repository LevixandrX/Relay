import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { authPairings } from "@/db/schema";
import { id, now } from "@/lib/ids";
import {
  hashClaimSecret,
  newClaimSecret,
  type OAuthProvider,
} from "@/domain/auth/oauth";

const TTL_MS = 10 * 60 * 1000;

export type PairingStatus =
  | { status: "pending" }
  | { status: "ready"; accessToken: string }
  | { status: "error"; message: string }
  | { status: "expired" };

async function dropExpired() {
  await db.delete(authPairings).where(lt(authPairings.expiresAt, now()));
}

/** Creates a pairing row. Returns public code + claimSecret (shown only to the desktop app). */
export async function createPairing(provider: OAuthProvider) {
  await dropExpired();
  const code = `pr_${id.token()}`;
  const claimSecret = newClaimSecret();
  const ts = new Date();
  await db.insert(authPairings).values({
    code,
    provider,
    claimSecretHash: hashClaimSecret(claimSecret),
    expiresAt: new Date(ts.getTime() + TTL_MS).toISOString(),
    createdAt: ts.toISOString(),
  });
  return { code, claimSecret };
}

export async function completePairing(input: {
  code: string;
  provider: OAuthProvider;
  accessToken: string;
}) {
  const res = await db
    .update(authPairings)
    .set({ accessToken: input.accessToken })
    .where(
      and(
        eq(authPairings.code, input.code),
        eq(authPairings.provider, input.provider),
      ),
    );
  return res.rowsAffected > 0;
}

export async function failPairing(code: string, message: string) {
  await db.update(authPairings).set({ error: message }).where(eq(authPairings.code, code));
}

/** Returns the token once if claimSecret matches, then burns the pairing row. */
export async function claimPairing(code: string, claimSecret: string): Promise<PairingStatus> {
  const rows = await db
    .select()
    .from(authPairings)
    .where(eq(authPairings.code, code))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "expired" };

  if (row.claimSecretHash !== hashClaimSecret(claimSecret)) {
    return { status: "error", message: "invalid_claim_secret" };
  }

  if (row.expiresAt < now()) {
    await db.delete(authPairings).where(eq(authPairings.code, code));
    return { status: "expired" };
  }
  if (row.error) {
    await db.delete(authPairings).where(eq(authPairings.code, code));
    return { status: "error", message: row.error };
  }
  if (!row.accessToken) return { status: "pending" };

  await db.delete(authPairings).where(eq(authPairings.code, code));
  return { status: "ready", accessToken: row.accessToken };
}
