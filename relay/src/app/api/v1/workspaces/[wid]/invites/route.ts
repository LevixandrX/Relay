import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { invites } from "@/db/schema";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { requireWorkspaceAccess } from "@/domain/access";
import { id, now } from "@/lib/ids";
import { writeAudit } from "@/domain/audit";
import { assertEntitlement } from "@/domain/billing/entitlements";

type Ctx = { params: Promise<{ wid: string }> };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    await requireWorkspaceAccess(user.id, wid, "manage");
    await assertEntitlement(user.id, "invite_member", { workspaceId: wid });

    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(["editor", "viewer"]),
      })
      .parse(await req.json());

    const email = body.email.trim().toLowerCase();
    const token = id.token();
    const inviteId = id.invite();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Always pending — the invitee must accept (no silent membership injection).
    await db.insert(invites).values({
      id: inviteId,
      workspaceId: wid,
      email,
      role: body.role,
      tokenHash: hashToken(token),
      expiresAt: expires,
      createdAt: now(),
    });

    await writeAudit({
      workspaceId: wid,
      actorId: user.id,
      action: "member.invite",
      targetType: "invite",
      targetId: inviteId,
      meta: { email, role: body.role },
    });

    return json(
      {
        id: inviteId,
        email,
        role: body.role,
        // Returned once for MVP without email — paste to teammate
        acceptToken: token,
        expiresAt: expires,
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
