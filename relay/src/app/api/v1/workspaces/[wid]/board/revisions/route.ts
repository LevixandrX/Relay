import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { listWorkspaceBoardRevisions } from "@/domain/board/revisions";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    const revisions = await listWorkspaceBoardRevisions(user.id, wid);
    return json({ revisions });
  } catch (err) {
    return handleRouteError(err);
  }
}
