import { and, asc, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, pages, pageRevisions, type Role } from "@/db/schema";
import { ApiError } from "@/lib/errors";
import { id, now } from "@/lib/ids";
import {
  docToPlainText,
  emptyDoc,
  parseDoc,
  type Doc,
} from "@/domain/blocks/schema";
import { writeAudit } from "@/domain/audit";

export async function getPageForUser(userId: string, pageId: string) {
  const rows = await db
    .select({
      page: pages,
      role: memberships.role,
    })
    .from(pages)
    .innerJoin(
      memberships,
      and(eq(memberships.workspaceId, pages.workspaceId), eq(memberships.userId, userId)),
    )
    .where(and(eq(pages.id, pageId), isNull(pages.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

export async function listPagesForWorkspace(userId: string, workspaceId: string) {
  const mem = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);
  if (!mem[0]) throw new ApiError(404, "not_found", "Not found");

  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      icon: pages.icon,
      parentPageId: pages.parentPageId,
      position: pages.position,
      updatedAt: pages.updatedAt,
      publicId: pages.publicId,
    })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt)))
    .orderBy(asc(pages.position));

  return { role: mem[0].role as Role, pages: rows };
}

export async function createPage(input: {
  userId: string;
  workspaceId: string;
  parentPageId?: string | null;
  title?: string;
  icon?: string;
  content?: Doc;
  position?: number;
}) {
  const pageId = id.page();
  const content = input.content ?? emptyDoc();
  const ts = now();
  await db.insert(pages).values({
    id: pageId,
    workspaceId: input.workspaceId,
    parentPageId: input.parentPageId ?? null,
    title: input.title ?? "",
    icon: input.icon ?? null,
    position: input.position ?? Date.now() % 1_000_000,
    content: JSON.stringify(content),
    plainText: docToPlainText(content),
    createdBy: input.userId,
    createdAt: ts,
    updatedAt: ts,
  });
  await writeAudit({
    workspaceId: input.workspaceId,
    actorId: input.userId,
    action: "page.create",
    targetType: "page",
    targetId: pageId,
    meta: { title: input.title ?? "" },
  });
  return pageId;
}

export async function updatePage(input: {
  userId: string;
  pageId: string;
  title?: string;
  icon?: string | null;
  content?: unknown;
  board?: unknown;
  baseUpdatedAt: string;
}) {
  const found = await getPageForUser(input.userId, input.pageId);
  if (!found) throw new ApiError(404, "not_found", "Not found");
  if (found.role === "viewer") throw new ApiError(403, "forbidden", "Insufficient permissions");

  if (found.page.updatedAt !== input.baseUpdatedAt) {
    throw new ApiError(409, "conflict", "Page was updated elsewhere", {
      serverUpdatedAt: found.page.updatedAt,
    });
  }

  let contentJson: string | undefined;
  let plainText: string | undefined;
  let boardJson: string | undefined;
  if (input.content !== undefined) {
    const doc = parseDoc(input.content);
    contentJson = JSON.stringify(doc);
    plainText = docToPlainText(doc);
  }
  if (input.board !== undefined) {
    const raw = JSON.stringify(input.board);
    if (raw.length > 8_000_000) {
      throw new ApiError(400, "validation_error", "Холст слишком большой");
    }
    boardJson = raw;
  }

  const ts = now();
  // maybe revision if last one older than 10 min
  const revs = await db
    .select()
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, found.page.id))
    .orderBy(sql`${pageRevisions.createdAt} desc`)
    .limit(1);
  const lastRev = revs[0];
  const shouldRev =
    !lastRev || Date.now() - new Date(lastRev.createdAt).getTime() > 10 * 60 * 1000;
  if (shouldRev) {
    await db.insert(pageRevisions).values({
      id: id.revision(),
      pageId: found.page.id,
      workspaceId: found.page.workspaceId,
      title: found.page.title,
      content: found.page.content,
      createdBy: input.userId,
      createdAt: ts,
    });
  }

  await db
    .update(pages)
    .set({
      title: input.title ?? found.page.title,
      icon: input.icon === undefined ? found.page.icon : input.icon,
      content: contentJson ?? found.page.content,
      board: boardJson ?? found.page.board,
      plainText: plainText ?? found.page.plainText,
      updatedAt: ts,
    })
    .where(eq(pages.id, found.page.id));

  await writeAudit({
    workspaceId: found.page.workspaceId,
    actorId: input.userId,
    action: "page.update",
    targetType: "page",
    targetId: found.page.id,
  });

  return {
    id: found.page.id,
    updatedAt: ts,
    revisionCreated: shouldRev,
  };
}

export async function searchPages(userId: string, workspaceId: string, q: string) {
  const mem = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);
  if (!mem[0]) throw new ApiError(404, "not_found", "Not found");

  const term = `%${q.trim()}%`;
  const rows = await db
    .select({
      pageId: pages.id,
      title: pages.title,
      icon: pages.icon,
      plainText: pages.plainText,
    })
    .from(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        isNull(pages.deletedAt),
        or(like(pages.title, term), like(pages.plainText, term)),
      ),
    )
    .limit(20);

  return rows.map((r) => {
    const idx = r.plainText.toLowerCase().indexOf(q.trim().toLowerCase());
    const snippet =
      idx >= 0
        ? r.plainText.slice(Math.max(0, idx - 40), idx + 80)
        : r.plainText.slice(0, 120);
    return {
      pageId: r.pageId,
      title: r.title || "Untitled",
      icon: r.icon,
      snippet,
    };
  });
}

export function serializePage(page: typeof pages.$inferSelect, role?: Role) {
  return {
    id: page.id,
    workspaceId: page.workspaceId,
    parentPageId: page.parentPageId,
    title: page.title,
    icon: page.icon,
    position: page.position,
    content: JSON.parse(page.content) as Doc,
    board: page.board ? (JSON.parse(page.board) as unknown) : null,
    publicId: page.publicId,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    role,
  };
}
