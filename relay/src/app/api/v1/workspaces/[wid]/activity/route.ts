import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { listWorkspaceUpdates } from "@/domain/activity/report";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    const updates = await listWorkspaceUpdates(user.id, wid);
    return json({ revisions: updates });
  } catch (err) {
    return handleRouteError(err);
  }
}
