import { z } from "zod";
import { db } from "@/db/client";
import { memberships, workspaces } from "@/db/schema";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { id, now, slugify } from "@/lib/ids";
import { writeAudit } from "@/domain/audit";
import { createPage } from "@/domain/pages/repo";
import { emptyDoc } from "@/domain/blocks/schema";
import { assertEntitlement } from "@/domain/billing/entitlements";
import { listWorkspacesForUser } from "@/domain/workspaces/list";

export async function GET() {
  try {
    const user = await requireSession();
    const rows = await listWorkspacesForUser(user.id);
    return json({ workspaces: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    await assertEntitlement(user.id, "create_workspace");
    const body = z.object({ name: z.string().min(1).max(80) }).parse(await req.json());
    const wsId = id.workspace();
    const ts = now();
    await db.insert(workspaces).values({
      id: wsId,
      name: body.name,
      slug: slugify(body.name),
      createdBy: user.id,
      createdAt: ts,
    });
    await db.insert(memberships).values({
      id: id.membership(),
      workspaceId: wsId,
      userId: user.id,
      role: "owner",
      createdAt: ts,
    });
    const pageId = await createPage({
      userId: user.id,
      workspaceId: wsId,
      title: "Untitled",
      content: emptyDoc(),
    });
    await writeAudit({
      workspaceId: wsId,
      actorId: user.id,
      action: "workspace.create",
      targetType: "workspace",
      targetId: wsId,
    });
    return json({ id: wsId, firstPageId: pageId }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
