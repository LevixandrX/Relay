import { ApiError, handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { requireWorkspaceAccess } from "@/domain/access";
import { searchPages } from "@/domain/pages/repo";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    await requireWorkspaceAccess(user.id, wid, "read");
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 1) return json({ results: [] });
    if (q.length > 100) throw new ApiError(400, "validation_error", "Слишком длинный запрос");
    const results = await searchPages(user.id, wid, q);
    return json({ results });
  } catch (err) {
    return handleRouteError(err);
  }
}
