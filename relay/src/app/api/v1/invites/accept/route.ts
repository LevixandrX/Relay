import { z } from "zod";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { invites, memberships } from "@/db/schema";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { id, now } from "@/lib/ids";
import { writeAudit } from "@/domain/audit";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    const body = z.object({ token: z.string().min(8) }).parse(await req.json());
    const tokenHash = hashToken(body.token);

    const rows = await db
      .select()
      .from(invites)
      .where(and(eq(invites.tokenHash, tokenHash), isNull(invites.acceptedAt)))
      .limit(1);
    const invite = rows[0];
    if (!invite) throw new ApiError(404, "not_found", "Приглашение не найдено или уже принято");
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new ApiError(410, "expired", "Срок приглашения истёк");
    }

    const email = user.email.trim().toLowerCase();
    if (invite.email !== email) {
      throw new ApiError(
        403,
        "email_mismatch",
        `Войди как ${invite.email}, чтобы принять приглашение`,
      );
    }

    const existing = await db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.workspaceId, invite.workspaceId), eq(memberships.userId, user.id)),
      )
      .limit(1);

    if (!existing[0]) {
      await db.insert(memberships).values({
        id: id.membership(),
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
        createdAt: now(),
      });
    }

    await db
      .update(invites)
      .set({ acceptedAt: now() })
      .where(eq(invites.id, invite.id));

    await writeAudit({
      workspaceId: invite.workspaceId,
      actorId: user.id,
      action: "member.join",
      targetType: "membership",
      targetId: user.id,
      meta: { role: invite.role, inviteId: invite.id },
    });

    return json({
      workspaceId: invite.workspaceId,
      role: invite.role,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
