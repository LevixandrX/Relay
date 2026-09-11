import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, users } from "@/db/schema";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { requireWorkspaceAccess } from "@/domain/access";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    await requireWorkspaceAccess(user.id, wid, "read");
    const pageId = new URL(req.url).searchParams.get("pageId");

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(
        pageId
          ? and(eq(auditLogs.workspaceId, wid), eq(auditLogs.targetId, pageId))
          : eq(auditLogs.workspaceId, wid),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(40);

    return json({
      events: rows.map((r) => ({
        ...r,
        meta: r.meta ? JSON.parse(r.meta) : null,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
