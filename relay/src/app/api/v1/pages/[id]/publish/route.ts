import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pages, type Role } from "@/db/schema";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { can } from "@/domain/access";
import { getPageForUser } from "@/domain/pages/repo";
import { id as ids, now } from "@/lib/ids";
import { writeAudit } from "@/domain/audit";
import { assertEntitlement } from "@/domain/billing/entitlements";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id } = await ctx.params;
    const found = await getPageForUser(user.id, id);
    if (!found) throw new ApiError(404, "not_found", "Not found");
    if (!can(found.role as Role, "manage") && !can(found.role as Role, "write")) {
      if (found.role === "viewer") {
        throw new ApiError(403, "forbidden", "Insufficient permissions");
      }
    }
    if (!found.page.publicId) {
      await assertEntitlement(user.id, "publish_page", {
        workspaceId: found.page.workspaceId,
      });
    }
    const publicId = found.page.publicId ?? ids.public();
    await db
      .update(pages)
      .set({ publicId, updatedAt: now() })
      .where(eq(pages.id, id));
    await writeAudit({
      workspaceId: found.page.workspaceId,
      actorId: user.id,
      action: "page.publish",
      targetType: "page",
      targetId: id,
      meta: { publicId },
    });
    return json({ publicId });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id } = await ctx.params;
    const found = await getPageForUser(user.id, id);
    if (!found) throw new ApiError(404, "not_found", "Not found");
    if (found.role === "viewer") {
      throw new ApiError(403, "forbidden", "Insufficient permissions");
    }
    await db
      .update(pages)
      .set({ publicId: null, updatedAt: now() })
      .where(eq(pages.id, id));
    await writeAudit({
      workspaceId: found.page.workspaceId,
      actorId: user.id,
      action: "page.unpublish",
      targetType: "page",
      targetId: id,
    });
    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
