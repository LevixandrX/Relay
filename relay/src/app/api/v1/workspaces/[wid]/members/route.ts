import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, users } from "@/db/schema";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { requireWorkspaceAccess } from "@/domain/access";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    await requireWorkspaceAccess(user.id, wid, "read");

    const members = await db
      .select({
        id: memberships.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, wid));

    return json({ members });
  } catch (err) {
    return handleRouteError(err);
  }
}
