import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, contentViews, pageRevisions, pages, users, workspaces } from "@/db/schema";
import { id, now } from "@/lib/ids";
import { requireWorkspaceAccess } from "@/domain/access";
import { listWorkspaceBoardRevisions } from "@/domain/board/revisions";
import { listPageRevisions } from "@/domain/pages/revisions";
import type { HistoryEntry } from "@/domain/history/preview";

const VIEW_GAP_MS = 30 * 60 * 1000;
const EDIT_ACTIONS = ["page.create", "page.update", "page.restore", "board.update", "board.restore"];

export type ActivityUpdate = HistoryEntry & {
  pageId: string | null;
  scope: "page" | "board";
};

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

export type AnalyticsReport = {
  range: AnalyticsRange;
  totalViews: number;
  buckets: { start: string; views: number; edits: number }[];
  viewers: { name: string; avatarUrl: string | null; seenAt: string }[];
  createdBy: { name: string; avatarUrl: string | null; at: string } | null;
  editors: { name: string; avatarUrl: string | null; at: string }[];
};

export async function listWorkspaceUpdates(userId: string, workspaceId: string): Promise<ActivityUpdate[]> {
  await requireWorkspaceAccess(userId, workspaceId, "read");
  const recent = await db
    .select({ pageId: pageRevisions.pageId })
    .from(pageRevisions)
    .where(eq(pageRevisions.workspaceId, workspaceId))
    .orderBy(desc(pageRevisions.createdAt))
    .limit(40);
  const pageIds: string[] = [];
  for (const row of recent) {
    if (!pageIds.includes(row.pageId)) pageIds.push(row.pageId);
    if (pageIds.length >= 8) break;
  }

  const updates: ActivityUpdate[] = [];
  for (const pageId of pageIds) {
    try {
      const entries = await listPageRevisions(userId, pageId);
      for (const entry of entries) {
        if (entry.baseline) continue;
        updates.push({ ...entry, pageId, scope: "page" });
      }
    } catch {
      /* page gone or unreadable */
    }
  }

  const board = await listWorkspaceBoardRevisions(userId, workspaceId);
  for (const entry of board) {
    if (entry.baseline) continue;
    updates.push({ ...entry, pageId: null, scope: "board" });
  }

  updates.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return updates.slice(0, 24);
}

export async function recordContentView(input: {
  userId: string;
  workspaceId: string;
  pageId: string | null;
}) {
  await requireWorkspaceAccess(input.userId, input.workspaceId, "read");
  const since = new Date(Date.now() - VIEW_GAP_MS).toISOString();
  const scope = input.pageId
    ? eq(contentViews.pageId, input.pageId)
    : isNull(contentViews.pageId);
  const recent = await db
    .select({ id: contentViews.id })
    .from(contentViews)
    .where(
      and(
        eq(contentViews.workspaceId, input.workspaceId),
        eq(contentViews.userId, input.userId),
        scope,
        gte(contentViews.createdAt, since),
      ),
    )
    .limit(1);
  if (recent[0]) return { recorded: false };

  await db.insert(contentViews).values({
    id: id.view(),
    workspaceId: input.workspaceId,
    pageId: input.pageId,
    userId: input.userId,
    createdAt: now(),
  });
  return { recorded: true };
}

export async function workspaceAnalytics(input: {
  userId: string;
  workspaceId: string;
  pageId: string | null;
  range: AnalyticsRange;
}): Promise<AnalyticsReport> {
  await requireWorkspaceAccess(input.userId, input.workspaceId, "read");
  const since = rangeStart(input.range);
  const viewScope = input.pageId
    ? eq(contentViews.pageId, input.pageId)
    : eq(contentViews.workspaceId, input.workspaceId);
  const viewWhere = since
    ? and(eq(contentViews.workspaceId, input.workspaceId), viewScope, gte(contentViews.createdAt, since))
    : and(eq(contentViews.workspaceId, input.workspaceId), viewScope);

  const views = await db
    .select({
      createdAt: contentViews.createdAt,
      name: users.name,
      avatarUrl: users.avatarUrl,
      userId: contentViews.userId,
    })
    .from(contentViews)
    .leftJoin(users, eq(users.id, contentViews.userId))
    .where(viewWhere)
    .orderBy(desc(contentViews.createdAt))
    .limit(2000);

  const editWhere = since
    ? and(
        eq(auditLogs.workspaceId, input.workspaceId),
        inArray(auditLogs.action, EDIT_ACTIONS),
        gte(auditLogs.createdAt, since),
      )
    : and(eq(auditLogs.workspaceId, input.workspaceId), inArray(auditLogs.action, EDIT_ACTIONS));

  const edits = await db
    .select({
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      targetId: auditLogs.targetId,
      actorId: auditLogs.actorId,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(editWhere)
    .orderBy(desc(auditLogs.createdAt))
    .limit(2000);

  const scopedEdits = input.pageId
    ? edits.filter((row) => row.action.startsWith("page.") && row.targetId === input.pageId)
    : edits;

  const viewTimes = views.map((row) => row.createdAt);
  const editTimes = scopedEdits.map((row) => row.createdAt);
  const buckets = bucketSeries(input.range, viewTimes, editTimes);

  const viewers: AnalyticsReport["viewers"] = [];
  const seenUsers = new Set<string>();
  for (const row of views) {
    if (seenUsers.has(row.userId)) continue;
    seenUsers.add(row.userId);
    viewers.push({
      name: row.name || "",
      avatarUrl: row.avatarUrl,
      seenAt: row.createdAt,
    });
    if (viewers.length >= 8) break;
  }

  const editors: AnalyticsReport["editors"] = [];
  const seenEditors = new Set<string>();
  for (const row of scopedEdits) {
    if (!row.actorId || seenEditors.has(row.actorId)) continue;
    seenEditors.add(row.actorId);
    editors.push({
      name: row.name || "",
      avatarUrl: row.avatarUrl,
      at: row.createdAt,
    });
    if (editors.length >= 6) break;
  }

  return {
    range: input.range,
    totalViews: viewTimes.length,
    buckets,
    viewers,
    createdBy: await createdBy(input.workspaceId, input.pageId),
    editors,
  };
}

async function createdBy(workspaceId: string, pageId: string | null) {
  if (pageId) {
    const rows = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
        at: pages.createdAt,
      })
      .from(pages)
      .leftJoin(users, eq(users.id, pages.createdBy))
      .where(and(eq(pages.id, pageId), eq(pages.workspaceId, workspaceId)))
      .limit(1);
    const row = rows[0];
    if (!row?.name) return null;
    return { name: row.name, avatarUrl: row.avatarUrl, at: row.at };
  }
  const rows = await db
    .select({
      name: users.name,
      avatarUrl: users.avatarUrl,
      at: workspaces.createdAt,
    })
    .from(workspaces)
    .leftJoin(users, eq(users.id, workspaces.createdBy))
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const row = rows[0];
  if (!row?.name) return null;
  return { name: row.name, avatarUrl: row.avatarUrl, at: row.at };
}

function rangeStart(range: AnalyticsRange): string | null {
  const days = range === "7d" ? 6 : range === "30d" ? 29 : range === "90d" ? 89 : 0;
  if (!days) return null;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString();
}

function bucketSeries(range: AnalyticsRange, views: string[], edits: string[]) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  let start = new Date(end);
  let step = 1;
  if (range === "7d") start.setUTCDate(start.getUTCDate() - 6);
  else if (range === "30d") start.setUTCDate(start.getUTCDate() - 29);
  else if (range === "90d") start.setUTCDate(start.getUTCDate() - 89);
  else {
    const earliest = [...views, ...edits].reduce<string | null>((min, iso) => {
      if (!min || iso < min) return iso;
      return min;
    }, null);
    start = earliest ? new Date(earliest.slice(0, 10) + "T00:00:00.000Z") : new Date(end);
    const span = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (span > 120) step = 7;
  }

  const buckets: { start: string; views: number; edits: number }[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + step)) {
    buckets.push({ start: cursor.toISOString().slice(0, 10), views: 0, edits: 0 });
  }
  if (buckets.length === 0) buckets.push({ start: end.toISOString().slice(0, 10), views: 0, edits: 0 });

  const index = new Map(buckets.map((bucket, i) => [bucket.start, i]));
  const place = (iso: string, key: "views" | "edits") => {
    const day = iso.slice(0, 10);
    let slot = index.get(day);
    if (slot === undefined && step > 1) {
      const found = buckets.findIndex((bucket, i) => {
        const next = buckets[i + 1]?.start;
        return day >= bucket.start && (!next || day < next);
      });
      slot = found === -1 ? undefined : found;
    }
    if (slot === undefined) return;
    buckets[slot][key] += 1;
  };
  for (const iso of views) place(iso, "views");
  for (const iso of edits) place(iso, "edits");
  return buckets;
}
