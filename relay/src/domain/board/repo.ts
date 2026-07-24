import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { ApiError } from "@/lib/errors";
import { requireWorkspaceAccess } from "@/domain/access";
import { writeAudit } from "@/domain/audit";
import { now } from "@/lib/ids";

export async function getWorkspaceBoard(userId: string, workspaceId: string) {
  await requireWorkspaceAccess(userId, workspaceId, "read");
  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name, board: workspaces.board })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Не найдено");
  return {
    id: rows[0].id,
    name: rows[0].name,
    board: rows[0].board ? JSON.parse(rows[0].board) : null,
  };
}

export async function saveWorkspaceBoard(
  userId: string,
  workspaceId: string,
  board: unknown,
) {
  await requireWorkspaceAccess(userId, workspaceId, "write");
  const raw = JSON.stringify(board);
  if (raw.length > 8_000_000) {
    throw new ApiError(400, "validation_error", "Холст слишком большой");
  }
  await db
    .update(workspaces)
    .set({ board: raw })
    .where(eq(workspaces.id, workspaceId));
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "board.update",
    targetType: "workspace",
    targetId: workspaceId,
  });
  return { updatedAt: now() };
}
