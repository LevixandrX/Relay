import { redirect, notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, pages, userChecklist, users, workspaces } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { listPagesForWorkspace, serializePage } from "@/domain/pages/repo";
import { WorkspaceApp } from "@/components/WorkspaceApp";
import type { BoardSnapshot } from "@/components/InfiniteBoard";
import type { Role } from "@/db/schema";

type Props = {
  params: Promise<{ wid: string; pageId: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function WorkspacePageView({ params, searchParams }: Props) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");

  const { wid, pageId } = await params;
  const sp = await searchParams;

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
  const pageRows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.workspaceId, wid), isNull(pages.deletedAt)))
    .limit(1);

  if (!pageRows[0]) notFound();

  const checklistRows = await db
    .select()
    .from(userChecklist)
    .where(eq(userChecklist.userId, user.id))
    .limit(1);

  const serialized = serializePage(pageRows[0], mem[0].role as Role);

  return (
    <WorkspaceApp
      workspaceId={wid}
      workspaceName={mem[0].name}
      pageId={pageId}
      role={mem[0].role}
      initialPages={pageList}
      workspaceBoard={mem[0].board ? (JSON.parse(mem[0].board) as BoardSnapshot) : null}
      initialPage={{
        id: serialized.id,
        title: serialized.title,
        icon: serialized.icon,
        content: serialized.content,
        board: (serialized.board as BoardSnapshot | null) ?? null,
        updatedAt: serialized.updatedAt,
        publicId: serialized.publicId,
      }}
      checklist={checklistRows[0] ?? null}
      ownerName={mem[0].ownerName}
      defaultMode={sp.mode === "text" ? "text" : "board"}
    />
  );
}
