import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, userChecklist, users, workspaces } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { listPagesForWorkspace } from "@/domain/pages/repo";
import { WorkspaceApp } from "@/components/WorkspaceApp";
import type { BoardSnapshot } from "@/components/InfiniteBoard";

type Props = { params: Promise<{ wid: string }> };

export default async function WorkspaceBoardPage({ params }: Props) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");
  const { wid } = await params;

  const mem = await db
    .select({
      role: memberships.role,
      name: workspaces.name,
      board: workspaces.board,
      ownerName: users.name,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .innerJoin(users, eq(users.id, workspaces.createdBy))
    .where(and(eq(memberships.workspaceId, wid), eq(memberships.userId, user.id)))
    .limit(1);
  if (!mem[0]) notFound();

  const { pages: pageList } = await listPagesForWorkspace(user.id, wid);
  const checklistRows = await db
    .select()
    .from(userChecklist)
    .where(eq(userChecklist.userId, user.id))
    .limit(1);

  return (
    <WorkspaceApp
      workspaceId={wid}
      workspaceName={mem[0].name}
      pageId={null}
      role={mem[0].role}
      initialPages={pageList}
      initialPage={null}
      workspaceBoard={mem[0].board ? (JSON.parse(mem[0].board) as BoardSnapshot) : null}
      ownerName={mem[0].ownerName}
      checklist={checklistRows[0] ?? null}
      viewerId={user.id}
      defaultMode="board"
    />
  );
}
