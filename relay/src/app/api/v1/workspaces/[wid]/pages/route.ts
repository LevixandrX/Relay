import { z } from "zod";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { requireWorkspaceAccess } from "@/domain/access";
import { createPage, listPagesForWorkspace } from "@/domain/pages/repo";
import { emptyDoc } from "@/domain/blocks/schema";
import { assertEntitlement } from "@/domain/billing/entitlements";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    await requireWorkspaceAccess(user.id, wid, "read");
    const data = await listPagesForWorkspace(user.id, wid);
    return json(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    await requireWorkspaceAccess(user.id, wid, "write");
    await assertEntitlement(user.id, "create_page", { workspaceId: wid });
    const body = z
      .object({
        parentPageId: z.string().nullable().optional(),
        title: z.string().max(300).optional(),
      })
      .parse(await req.json().catch(() => ({})));

    const pageId = await createPage({
      userId: user.id,
      workspaceId: wid,
      parentPageId: body.parentPageId,
      title: body.title ?? "",
      content: emptyDoc(),
    });
    return json({ id: pageId }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
