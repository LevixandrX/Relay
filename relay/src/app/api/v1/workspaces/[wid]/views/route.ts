import { z } from "zod";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { recordContentView } from "@/domain/activity/report";

type Ctx = { params: Promise<{ wid: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    const body = z.object({ pageId: z.string().nullable().optional() }).parse(await req.json());
    const result = await recordContentView({
      userId: user.id,
      workspaceId: wid,
      pageId: body.pageId ?? null,
    });
    return json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
