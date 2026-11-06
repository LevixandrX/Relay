import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { pageAssets, pages } from '@/db/schema';
import { getPageForUser, listPagesForWorkspace } from '@/domain/pages/repo';
import { ApiError } from '@/lib/errors';
import { assetUpload } from './assets';
import { MAX_PAGE_ASSET_BYTES } from './rich-content';
import type { JSONContent } from './schema';
const missing = () => new ApiError(404, 'not_found', 'Not found');
export async function resourcePage(userId: string, pageId: string, write = false) {
  const found = await getPageForUser(userId, pageId);
  if (!found) throw missing();
  if (write && found.role === 'viewer') throw new ApiError(403, 'forbidden', 'Insufficient permissions');
  return found.page;
}
export async function listResourcePages(userId: string, pageId: string) {
  const page = await resourcePage(userId, pageId);
  return (await listPagesForWorkspace(userId, page.workspaceId)).pages;
}
export async function uploadPageAsset(userId: string, pageId: string, input: unknown) {
  await resourcePage(userId, pageId, true);
  const file = assetUpload.parse(input), bytes = Buffer.from(file.data, 'base64');
  if (bytes.length !== file.size || bytes.toString('base64') !== file.data) throw new ApiError(400, 'invalid_file', 'Invalid file data');
  const record = { id: `asset_${randomUUID()}`, pageId, name: file.name, type: file.type, size: bytes.length, data: file.data, createdBy: userId, createdAt: new Date().toISOString() };
  // One writer transaction makes the per-page quota apply to concurrent uploads too.
  await db.transaction(async tx => {
    const [usage] = await tx.select({ total: sql<number>`coalesce(sum(${pageAssets.size}), 0)` }).from(pageAssets).where(eq(pageAssets.pageId, pageId));
    if (Number(usage.total) + file.size > MAX_PAGE_ASSET_BYTES) throw new ApiError(413, 'asset_limit', 'Page file limit reached');
    await tx.insert(pageAssets).values(record);
  });
  return { id: record.id, name: record.name, type: record.type, size: record.size };
}
export async function readPageAsset(userId: string, pageId: string, assetId: string) {
  await resourcePage(userId, pageId);
  const [record] = await db.select().from(pageAssets).where(and(eq(pageAssets.pageId, pageId), eq(pageAssets.id, assetId))).limit(1);
  if (!record) throw missing();
  return { id: record.id, name: record.name, type: record.type, size: record.size, data: record.data };
}
export async function publicAsset(publicId: string, assetId: string) {
  const [page] = await db.select().from(pages).where(and(eq(pages.publicId, publicId), isNull(pages.deletedAt))).limit(1);
  if (!page) throw missing();
  let referenced = false;
  const walk = (node: JSONContent) => { if ((node.attrs?.assetId === assetId || node.attrs?.iconAssetId === assetId)) referenced = true; node.content?.forEach(walk); };
  walk(JSON.parse(page.content));
  if (!referenced) throw missing();
  const [record] = await db.select().from(pageAssets).where(and(eq(pageAssets.pageId, page.id), eq(pageAssets.id, assetId))).limit(1);
  if (!record) throw missing();
  return record;
}
