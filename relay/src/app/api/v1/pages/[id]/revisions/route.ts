import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { listPageRevisions } from "@/domain/pages/revisions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id } = await ctx.params;
    const revisions = await listPageRevisions(user.id, id);
    return json({ revisions });
  } catch (err) {
    return handleRouteError(err);
  }
}
