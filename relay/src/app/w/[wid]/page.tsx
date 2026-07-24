import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, workspaces } from "@/db/schema";
import { requireSession } from "@/lib/session";

type Props = { params: Promise<{ wid: string }> };

/** Корень пространства → сразу на бесконечный холст */
export default async function WorkspaceHome({ params }: Props) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");
  const { wid } = await params;

  const mem = await db
    .select({ id: workspaces.id })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.workspaceId, wid), eq(memberships.userId, user.id)))
    .limit(1);
  if (!mem[0]) notFound();
  redirect(`/w/${wid}/board`);
}
