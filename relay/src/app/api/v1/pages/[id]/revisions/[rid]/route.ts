import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getPageRevision } from "@/domain/pages/revisions";

type Ctx = { params: Promise<{ id: string; rid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id, rid } = await ctx.params;
    return json(await getPageRevision(user.id, id, rid));
  } catch (err) {
    return handleRouteError(err);
  }
}
