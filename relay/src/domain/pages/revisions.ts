import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pageRevisions, pages, users, type Role } from "@/db/schema";
import { ApiError } from "@/lib/errors";
import { now } from "@/lib/ids";
import { can } from "@/domain/access";
import { writeAudit } from "@/domain/audit";
import { getPageForUser, snapshotPageRevision } from "@/domain/pages/repo";
import { docToPlainText, parseDoc, type Doc } from "@/domain/blocks/schema";

export type RevisionKind = "text" | "board" | "both";

function revisionKind(
  prev: { title: string; content: string; board: string | null } | null,
  cur: { title: string; content: string; board: string | null },
): RevisionKind {
  const textChanged = !prev || prev.title !== cur.title || prev.content !== cur.content;
  const boardChanged = !prev
    ? Boolean(cur.board)
    : (prev.board ?? "") !== (cur.board ?? "");
  if (textChanged && boardChanged) return "both";
  if (boardChanged) return "board";
  return "text";
}

export async function listPageRevisions(userId: string, pageId: string) {
  const found = await getPageForUser(userId, pageId);
  if (!found) throw new ApiError(404, "not_found", "Not found");

  const rows = await db
    .select({
      id: pageRevisions.id,
      title: pageRevisions.title,
      content: pageRevisions.content,
      board: pageRevisions.board,
      createdAt: pageRevisions.createdAt,
      createdByName: users.name,
    })
    .from(pageRevisions)
    .leftJoin(users, eq(users.id, pageRevisions.createdBy))
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(desc(pageRevisions.createdAt))
    .limit(80);

  return rows.map((row, i) => {
    const older = rows[i + 1]
      ? {
          title: rows[i + 1].title,
          content: rows[i + 1].content,
          board: rows[i + 1].board,
        }
      : null;
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      createdByName: row.createdByName,
      kind: revisionKind(older, row),
      hasBoard: Boolean(row.board),
    };
  });
}

export async function getPageRevision(userId: string, pageId: string, revisionId: string) {
  const found = await getPageForUser(userId, pageId);
  if (!found) throw new ApiError(404, "not_found", "Not found");

  const rows = await db
    .select({
      id: pageRevisions.id,
      title: pageRevisions.title,
      content: pageRevisions.content,
      board: pageRevisions.board,
      createdAt: pageRevisions.createdAt,
      createdByName: users.name,
    })
    .from(pageRevisions)
    .leftJoin(users, eq(users.id, pageRevisions.createdBy))
    .where(and(eq(pageRevisions.id, revisionId), eq(pageRevisions.pageId, pageId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new ApiError(404, "not_found", "Not found");

  let content: Doc;
  try {
    content = parseDoc(JSON.parse(row.content));
  } catch {
    content = parseDoc({ type: "doc", content: [] });
  }

  let board: unknown = null;
  if (row.board) {
    try {
      board = JSON.parse(row.board);
    } catch {
      board = null;
    }
  }

  return {
    id: row.id,
    title: row.title,
    content,
    board,
    createdAt: row.createdAt,
    createdByName: row.createdByName,
  };
}

export async function restorePageRevision(
  userId: string,
  pageId: string,
  revisionId: string,
) {
  const found = await getPageForUser(userId, pageId);
  if (!found) throw new ApiError(404, "not_found", "Not found");
  if (!can(found.role as Role, "write")) {
    throw new ApiError(403, "forbidden", "Insufficient permissions");
  }

  const rev = await db
    .select()
    .from(pageRevisions)
    .where(and(eq(pageRevisions.id, revisionId), eq(pageRevisions.pageId, pageId)))
    .limit(1);
  if (!rev[0]) throw new ApiError(404, "not_found", "Not found");

  await snapshotPageRevision({ page: found.page, userId, force: true });

  let restoredDoc: Doc;
  try {
    restoredDoc = parseDoc(JSON.parse(rev[0].content));
  } catch {
    restoredDoc = parseDoc({ type: "doc", content: [] });
  }

  const board =
    rev[0].board === null
      ? found.page.board
      : rev[0].board === ""
        ? null
        : rev[0].board;
  const ts = now();
  await db
    .update(pages)
    .set({
      title: rev[0].title,
      content: rev[0].content,
      board,
      plainText: docToPlainText(restoredDoc),
      updatedAt: ts,
    })
    .where(eq(pages.id, pageId));

  await writeAudit({
    workspaceId: found.page.workspaceId,
    actorId: userId,
    action: "page.restore",
    targetType: "page",
    targetId: pageId,
    meta: { title: rev[0].title, revisionId },
  });

  return { id: pageId, updatedAt: ts };
}
