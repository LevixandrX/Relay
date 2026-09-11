import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getWorkspaceBoardRevision } from "@/domain/board/revisions";

type Ctx = { params: Promise<{ wid: string; rid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid, rid } = await ctx.params;
    return json(await getWorkspaceBoardRevision(user.id, wid, rid));
  } catch (err) {
    return handleRouteError(err);
  }
}
