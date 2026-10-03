import type { HistoryBlock, RevisionSummary } from "../../components/VersionHistory";

const KEY = "relay.activity.focus";
const EVENT = "relay:activity-focus";

export type ActivityFocus = {
  pageId: string | null;
  mode: "text" | "board";
  blockType?: HistoryBlock["type"];
  phrases: string[];
  shapeIds: string[];
  createdAt: number;
};

export function focusFromRevision(row: RevisionSummary, selectedBlock?: HistoryBlock): ActivityFocus {
  const blocks = selectedBlock ? [selectedBlock] : row.blocks;
  const boardBlocks = blocks.filter((block) => block.type === "board");
  const textBlocks = blocks.filter((block) => block.type !== "board");
  const spans = blocks
    .flatMap((block) => [
      ...(block.spans ?? []),
      ...(block.lines ?? []).flat(),
      ...(block.items ?? []).flat(),
    ]);
  const additions = spans.filter((span) => span.m === "add");
  const phrases = (additions.length > 0 ? additions : spans.filter((span) => span.m !== "del"))
    .map((span) => span.t.trim())
    .filter(Boolean)
    .slice(0, 8);
  return {
    pageId: row.scope === "board" ? null : (row.pageId ?? null),
    mode: boardBlocks.length > 0 && textBlocks.length === 0 ? "board" : "text",
    blockType: selectedBlock?.type ?? textBlocks[0]?.type ?? boardBlocks[0]?.type,
    phrases,
    shapeIds: boardBlocks.flatMap((block) => block.targetIds ?? []),
    createdAt: Date.now(),
  };
}

export function stageActivityFocus(focus: ActivityFocus) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(focus));
  } catch {
    /* navigation still works when storage is unavailable */
  }
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(EVENT, { detail: focus })), 0);
}

export function subscribeActivityFocus(listener: (focus: ActivityFocus) => void) {
  const receive = (event: Event) => listener((event as CustomEvent<ActivityFocus>).detail);
  window.addEventListener(EVENT, receive);
  return () => window.removeEventListener(EVENT, receive);
}

export function readActivityFocus(pageId: string | null): ActivityFocus | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const focus = JSON.parse(raw) as ActivityFocus;
    if (Date.now() - focus.createdAt > 15_000 || focus.pageId !== pageId) return null;
    return focus;
  } catch {
    return null;
  }
}

export function clearActivityFocus() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
