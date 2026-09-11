import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { restorePageRevision } from "@/domain/pages/revisions";

type Ctx = { params: Promise<{ id: string; rid: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id, rid } = await ctx.params;
    return json(await restorePageRevision(user.id, id, rid));
  } catch (err) {
    return handleRouteError(err);
  }
}
