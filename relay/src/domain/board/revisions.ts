import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceRevisions, workspaces } from "@/db/schema";
import { ApiError } from "@/lib/errors";
import { id, now } from "@/lib/ids";
import { requireWorkspaceAccess } from "@/domain/access";
import { writeAudit } from "@/domain/audit";
import { historyEntries, parseStoredJson } from "@/domain/history/preview";

const MAX_REVISIONS = 80;

export async function snapshotWorkspaceBoard(input: {
  workspaceId: string;
  board: string | null;
  userId: string;
  force?: boolean;
}) {
  const latest = await db
    .select()
    .from(workspaceRevisions)
    .where(eq(workspaceRevisions.workspaceId, input.workspaceId))
    .orderBy(desc(workspaceRevisions.createdAt))
    .limit(1);
  const last = latest[0];
  const age = last ? Date.now() - new Date(last.createdAt).getTime() : Infinity;
  const changed = (last?.board ?? "") !== (input.board ?? "");
  const should = input.force || !last || age > 10 * 60 * 1000 || (age > 90 * 1000 && changed);
  if (!should) return false;

  await db.insert(workspaceRevisions).values({
    id: id.revision(),
    workspaceId: input.workspaceId,
    board: input.board ?? "",
    createdBy: input.userId,
    createdAt: now(),
  });

  const extras = await db
    .select({ id: workspaceRevisions.id })
    .from(workspaceRevisions)
    .where(eq(workspaceRevisions.workspaceId, input.workspaceId))
    .orderBy(asc(workspaceRevisions.createdAt));
  if (extras.length > MAX_REVISIONS) {
    const drop = extras.slice(0, extras.length - MAX_REVISIONS).map((r) => r.id);
    await db.delete(workspaceRevisions).where(inArray(workspaceRevisions.id, drop));
  }
  return true;
}

export async function listWorkspaceBoardRevisions(userId: string, workspaceId: string) {
  await requireWorkspaceAccess(userId, workspaceId, "read");
  const current = await db
    .select({ board: workspaces.board })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const rows = await db
    .select({
      id: workspaceRevisions.id,
      board: workspaceRevisions.board,
      createdAt: workspaceRevisions.createdAt,
      createdBy: workspaceRevisions.createdBy,
      createdByName: users.name,
      createdByAvatar: users.avatarUrl,
    })
    .from(workspaceRevisions)
    .leftJoin(users, eq(users.id, workspaceRevisions.createdBy))
    .where(eq(workspaceRevisions.workspaceId, workspaceId))
    .orderBy(desc(workspaceRevisions.createdAt))
    .limit(MAX_REVISIONS);

  return historyEntries(
    { title: "", content: null, board: parseStoredJson(current[0]?.board) },
    rows.map((row) => ({
      id: row.id,
      title: "",
      content: null,
      board: parseStoredJson(row.board),
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      createdByName: row.createdByName,
      createdByAvatar: row.createdByAvatar,
    })),
  );
}

export async function getWorkspaceBoardRevision(
  userId: string,
  workspaceId: string,
  revisionId: string,
) {
  await requireWorkspaceAccess(userId, workspaceId, "read");
  const rows = await db
    .select({
      id: workspaceRevisions.id,
      board: workspaceRevisions.board,
      createdAt: workspaceRevisions.createdAt,
      createdByName: users.name,
    })
    .from(workspaceRevisions)
    .leftJoin(users, eq(users.id, workspaceRevisions.createdBy))
    .where(
      and(eq(workspaceRevisions.id, revisionId), eq(workspaceRevisions.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Not found");
  let board: unknown = null;
  if (rows[0].board) {
    try {
      board = JSON.parse(rows[0].board);
    } catch {
      board = null;
    }
  }
  return {
    id: rows[0].id,
    title: "",
    content: null,
    board,
    createdAt: rows[0].createdAt,
    createdByName: rows[0].createdByName,
  };
}

export async function restoreWorkspaceBoardRevision(
  userId: string,
  workspaceId: string,
  revisionId: string,
) {
  await requireWorkspaceAccess(userId, workspaceId, "write");
  const current = await db
    .select({ board: workspaces.board })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!current[0]) throw new ApiError(404, "not_found", "Not found");

  const rev = await db
    .select()
    .from(workspaceRevisions)
    .where(
      and(eq(workspaceRevisions.id, revisionId), eq(workspaceRevisions.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!rev[0]) throw new ApiError(404, "not_found", "Not found");

  await snapshotWorkspaceBoard({
    workspaceId,
    board: current[0].board,
    userId,
    force: true,
  });

  await db
    .update(workspaces)
    .set({ board: rev[0].board || null })
    .where(eq(workspaces.id, workspaceId));
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "board.restore",
    targetType: "workspace",
    targetId: workspaceId,
  });
  return { updatedAt: now() };
}
