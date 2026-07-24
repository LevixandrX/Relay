import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { pages } from "@/db/schema";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import type { Doc } from "@/domain/blocks/schema";

type Ctx = { params: Promise<{ publicId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { publicId } = await ctx.params;
    const rows = await db
      .select()
      .from(pages)
      .where(and(eq(pages.publicId, publicId), isNull(pages.deletedAt)))
      .limit(1);
    const page = rows[0];
    if (!page) throw new ApiError(404, "not_found", "Not found");
    return json({
      title: page.title,
      icon: page.icon,
      content: JSON.parse(page.content) as Doc,
      updatedAt: page.updatedAt,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
