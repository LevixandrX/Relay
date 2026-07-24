import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pages } from "@/db/schema";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { can } from "@/domain/access";
import {
  getPageForUser,
  serializePage,
  updatePage,
} from "@/domain/pages/repo";
import { writeAudit } from "@/domain/audit";
import { now } from "@/lib/ids";
import type { Role } from "@/db/schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id } = await ctx.params;
    const found = await getPageForUser(user.id, id);
    if (!found) throw new ApiError(404, "not_found", "Not found");
    return json(serializePage(found.page, found.role as Role));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id } = await ctx.params;
    const body = z
      .object({
        title: z.string().max(300).optional(),
        icon: z.string().max(16).nullable().optional(),
        content: z.unknown().optional(),
        board: z.unknown().optional(),
        baseUpdatedAt: z.string(),
      })
      .parse(await req.json());

    const result = await updatePage({
      userId: user.id,
      pageId: id,
      title: body.title,
      icon: body.icon,
      content: body.content,
      board: body.board,
      baseUpdatedAt: body.baseUpdatedAt,
    });
    return json(result);
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
    if (!can(found.role as Role, "write")) {
      throw new ApiError(403, "forbidden", "Insufficient permissions");
    }
    await db
      .update(pages)
      .set({ deletedAt: now() })
      .where(eq(pages.id, id));
    await writeAudit({
      workspaceId: found.page.workspaceId,
      actorId: user.id,
      action: "page.delete",
      targetType: "page",
      targetId: id,
    });
    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
