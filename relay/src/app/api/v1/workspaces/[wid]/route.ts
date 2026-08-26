import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { requireWorkspaceAccess } from "@/domain/access";
import { now, slugify } from "@/lib/ids";
import { writeAudit } from "@/domain/audit";

type Ctx = { params: Promise<{ wid: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    await requireWorkspaceAccess(user.id, wid, "manage");
    const body = z.object({ name: z.string().trim().min(1).max(80) }).parse(await req.json());
    const ts = now();
    await db
      .update(workspaces)
      .set({ name: body.name, slug: slugify(body.name) })
      .where(eq(workspaces.id, wid));
    await writeAudit({
      workspaceId: wid,
      actorId: user.id,
      action: "workspace.rename",
      targetType: "workspace",
      targetId: wid,
      meta: { name: body.name },
    });
    return json({ id: wid, name: body.name, updatedAt: ts });
  } catch (err) {
    return handleRouteError(err);
  }
}
