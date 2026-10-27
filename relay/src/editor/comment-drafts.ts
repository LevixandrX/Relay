import type { CommentDraft, DraftAnchor } from "./comment-types";

export type SavedCommentDraft = { key: string; anchor?: DraftAnchor; value: CommentDraft; selection?: {start:number;end:number;direction:'forward'|'backward'|'none'} };
const memory = new Map<string, SavedCommentDraft[]>();
export const emptyCommentDraft = (): CommentDraft => ({ body: "", mentions: [], pages: [], dates: [], files: [] });
export const commentDraftScope = (identity: string, pageId: string) => `relay-comment-drafts-v1:${JSON.stringify([identity, pageId])}`;
export const newCommentDraftKey = (anchor: DraftAnchor) => `draft:${JSON.stringify([anchor.blockId, anchor.quote, anchor.anchorOffset])}`;
export const hasCommentDraft = (value: CommentDraft) => Boolean(value.body || value.files.length || value.pages.length || value.mentions.length || value.dates?.length);

export function readCommentDrafts(scope: string): SavedCommentDraft[] {
  const cached = memory.get(scope);
  if (cached) return cached;
  let drafts: SavedCommentDraft[] = [];
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(scope) ?? "[]");
    if (Array.isArray(stored)) drafts = stored.filter((item): item is SavedCommentDraft => {
      if (!item || typeof item.key !== "string" || !item.value || typeof item.value.body !== "string") return false;
      const value = item.value;
      return value.body.length <= 10000 && [value.mentions, value.pages, value.files].every(Array.isArray)
        && value.files.length <= 3 && value.files.every((f: Record<string, unknown>) => typeof f.data === "string" && typeof f.name === "string" && typeof f.size === "number" && f.size <= 2 * 1024 * 1024)
        && (!item.anchor || typeof item.anchor.blockId === "string" && typeof item.anchor.quote === "string");
    }).slice(0, 200);
  } catch { /* Session storage can be unavailable; in-memory drafts still work. */ }
  memory.set(scope, drafts);
  return drafts;
}
function write(scope: string, drafts: SavedCommentDraft[]) {
  memory.set(scope, drafts);
  try {
    if (drafts.length) sessionStorage.setItem(scope, JSON.stringify(drafts));
    else sessionStorage.removeItem(scope);
  } catch { /* Large attachments remain in memory when the browser quota is full. */ }
}
export function saveCommentDraft(scope: string, item: SavedCommentDraft) {
  stageCommentDraft(scope, item);
  write(scope, readCommentDrafts(scope));
}
/** Update the live draft immediately; serialization can wait until idle/blur. */
export function stageCommentDraft(scope: string, item: SavedCommentDraft) {
  const drafts = readCommentDrafts(scope).filter((d) => d.key !== item.key);
  if (hasCommentDraft(item.value) || item.anchor) drafts.push(item);
  memory.set(scope, drafts);
}
export function removeCommentDraft(scope: string, key: string) {
  write(scope, readCommentDrafts(scope).filter((d) => d.key !== key));
}
