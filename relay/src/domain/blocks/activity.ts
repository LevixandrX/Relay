import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { blockActivity, users, pages, memberships } from "@/db/schema";
import { ApiError } from "@/lib/errors";
import { changedActivityBlocks, type ActivityNode, type BlockActivityInfo } from "@/lib/block-activity";
export async function recordBlockActivity(tx: Pick<typeof db, "insert">, pageId: string, actor: string, before: ActivityNode, after: ActivityNode, ts: string) {
  for (const block of changedActivityBlocks(before, after)) await tx.insert(blockActivity).values({ id: randomUUID(), pageId, blockId: block.id, createdBy: block.created ? actor : null, createdAt: block.created ? ts : null, editedBy: actor, editedAt: ts }).onConflictDoUpdate({ target: [blockActivity.pageId, blockActivity.blockId], set: { editedBy: actor, editedAt: ts } });
}
export async function readBlockActivity(userId: string, pageId: string, blockId: string): Promise<BlockActivityInfo | null> {
  if (!(await db.select({ id: pages.id }).from(pages).innerJoin(memberships, and(eq(memberships.workspaceId, pages.workspaceId), eq(memberships.userId, userId))).where(and(eq(pages.id, pageId), isNull(pages.deletedAt))).limit(1)).length) throw new ApiError(404, "not_found", "Not found");
  const [row] = await db.select().from(blockActivity).where(and(eq(blockActivity.pageId, pageId), eq(blockActivity.blockId, blockId))).limit(1);
  if (!row) return null;
  const [editor] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.editedBy)).limit(1);
  const [creator] = row.createdBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, row.createdBy)).limit(1) : [];
  return { createdBy: creator?.name ?? null, createdAt: row.createdAt, editedBy: editor?.name ?? row.editedBy, editedAt: row.editedAt };
}
