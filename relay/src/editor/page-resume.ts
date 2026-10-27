import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

export type ResumePoint = { block: string; offset: number; fallback: number };
export type PageResume = {
  version: 1; scroll: number; viewport: { block: string; offset: number } | null;
  caret: ResumePoint | null; editing: boolean;
};
export const pageResumeKey = (identity: string, page: string) => `relay:page-resume:${JSON.stringify([identity, page])}`;
export function parsePageResume(raw: string | null): PageResume | null {
  try {
    const value = JSON.parse(raw ?? "null");
    const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
    const position = (n: unknown): n is number => finite(n) && Number.isSafeInteger(n) && n >= 0;
    if (value?.version !== 1 || !finite(value.scroll) || value.scroll < 0 || typeof value.editing !== "boolean") return null;
    if (value.viewport !== null && (typeof value.viewport?.block !== "string" || !finite(value.viewport?.offset))) return null;
    if (value.caret !== null && (typeof value.caret?.block !== "string" || !position(value.caret?.offset) || !position(value.caret?.fallback))) return null;
    return value;
  } catch { return null; }
}
export function captureCaret(doc: PMNode, position: number): ResumePoint {
  const resolved = doc.resolve(position);
  for (let depth = resolved.depth; depth > 0; depth--) {
    const block = resolved.node(depth).attrs.blockId;
    if (typeof block === "string" && block) return { block, offset: position - resolved.start(depth), fallback: position };
  }
  return { block: "", offset: 0, fallback: position };
}
export function resumeSelection(doc: PMNode, caret: ResumePoint) {
  let position = Math.max(0, Math.min(doc.content.size, caret.fallback));
  let found = false;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (caret.block && node.attrs.blockId === caret.block) {
      position = pos + 1 + Math.max(0, Math.min(node.content.size, caret.offset)); found = true; return false;
    }
  });
  return TextSelection.near(doc.resolve(Math.min(position, doc.content.size)));
}
