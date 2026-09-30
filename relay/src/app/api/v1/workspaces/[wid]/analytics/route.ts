import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { workspaceAnalytics, type AnalyticsRange } from "@/domain/activity/report";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    const url = new URL(req.url);
    const pageId = url.searchParams.get("pageId");
    const range = url.searchParams.get("range");
    const allowed: AnalyticsRange[] = ["7d", "30d", "90d", "all"];
    const picked = allowed.includes(range as AnalyticsRange) ? (range as AnalyticsRange) : "30d";
    const report = await workspaceAnalytics({
      userId: user.id,
      workspaceId: wid,
      pageId: pageId || null,
      range: picked,
    });
    return json(report);
  } catch (err) {
    return handleRouteError(err);
  }
}
