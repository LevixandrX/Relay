import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { restoreWorkspaceBoardRevision } from "@/domain/board/revisions";

type Ctx = { params: Promise<{ wid: string; rid: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid, rid } = await ctx.params;
    return json(await restoreWorkspaceBoardRevision(user.id, wid, rid));
  } catch (err) {
    return handleRouteError(err);
  }
}
