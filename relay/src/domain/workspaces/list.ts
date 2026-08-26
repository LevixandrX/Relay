import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, users, workspaces } from "@/db/schema";

export type WorkspaceListItem = {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
  createdBy: string | null;
  ownerName: string;
};

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceListItem[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: memberships.role,
      createdBy: workspaces.createdBy,
      ownerName: users.name,
      memberCount: sql<number>`(
        select count(*) from memberships as m2 where m2.workspace_id = workspaces.id
      )`.mapWith(Number),
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .innerJoin(users, eq(users.id, workspaces.createdBy))
    .where(and(eq(memberships.userId, userId), isNull(workspaces.deletedAt)));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    createdBy: r.createdBy,
    ownerName: r.ownerName,
    memberCount: Number(r.memberCount) || 1,
  }));
}
