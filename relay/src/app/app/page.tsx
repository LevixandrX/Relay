import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, workspaces } from "@/db/schema";
import { requireSession } from "@/lib/session";

export default async function AppRedirectPage() {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");

  const ws = await db
    .select({ id: workspaces.id })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, user.id))
    .limit(1);

  if (!ws[0]) redirect("/register");
  redirect(`/w/${ws[0].id}/board`);
}
