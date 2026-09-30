/**
 * Version history is a read-time view over snapshots.
 *
 * A snapshot stores the page *before* the save that created it. The edit at
 * that timestamp is the gap from that snapshot to the next newer state (the
 * following snapshot, or the live page). Consecutive edits by the same person
 * stay one event while each gap is under 10 minutes — a pause starts a new one.
 * The oldest snapshot is kept as a restorable earlier version.
 */

const GROUP_GAP_MS = 10 * 60 * 1000;
const MAX_BLOCKS = 6;
const MAX_SPAN = 360;

export type HistorySpan = { t: string; m?: "add" | "del"; href?: string };

export type HistoryBlock = {
  type:
    | "title"
    | "heading"
    | "quote"
    | "code"
    | "paragraph"
    | "list"
    | "todo"
    | "callout"
    | "image"
    | "embed"
    | "rule"
    | "board";
  level?: number;
  language?: string | null;
  ordered?: boolean;
  checked?: boolean;
  action?: "add" | "del" | "edit" | "move";
  shape?: string;
  count?: number;
  spans?: HistorySpan[];
  lines?: HistorySpan[][];
  items?: HistorySpan[][];
};

export type HistoryEntry = {
  id: string;
  restoreId: string | null;
  title: string;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByAvatar: string | null;
  baseline: boolean;
  blocks: HistoryBlock[];
  more: number;
};

export type HistoryRevision = {
  id: string;
  title: string;
  content: unknown;
  board: unknown;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByAvatar: string | null;
};

export type HistoryLive = {
  title: string;
  content: unknown;
  board: unknown;
};

type Piece = { t: string; href?: string };
type Flat = {
  type: string;
  level?: number;
  language?: string | null;
  ordered?: boolean;
  checked?: boolean;
  pieces: Piece[];
  text: string;
  lines?: string[];
  items?: { pieces: Piece[]; text: string }[];
};
type DocState = { title: string; content: unknown; board: unknown };
type More = { n: number };
type LcsOp = { op: "same" | "del" | "add"; i?: number; j?: number };

export function parseStoredJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function historyEntries(live: HistoryLive, revisions: HistoryRevision[]): HistoryEntry[] {
  if (revisions.length === 0) return [];

  const raw: RawEvent[] = revisions.map((rev, i) => {
    const after: DocState =
      i === 0
        ? { title: live.title, content: live.content, board: live.board }
        : {
            title: revisions[i - 1].title,
            content: revisions[i - 1].content,
            board: revisions[i - 1].board,
          };
    return {
      at: rev.createdAt,
      tailAt: rev.createdAt,
      by: rev.createdBy,
      byName: rev.createdByName,
      byAvatar: rev.createdByAvatar,
      title: after.title,
      restoreId: i === 0 ? null : revisions[i - 1].id,
      before: { title: rev.title, content: rev.content, board: rev.board },
      after,
    };
  });

  const grouped = groupEvents(raw)
    .map((event) => {
      const preview = diffStates(event.before, event.after);
      return { ...event, blocks: preview.blocks, more: preview.more };
    })
    .filter((event) => event.blocks.length > 0);

  const oldest = revisions[revisions.length - 1];
  if (grouped.length > 0 && oldest) {
    const earlier = excerptState({
      title: oldest.title,
      content: oldest.content,
      board: oldest.board,
    });
    if (earlier.blocks.length > 0) {
      grouped.push({
        at: oldest.createdAt,
        tailAt: oldest.createdAt,
        by: oldest.createdBy,
        byName: oldest.createdByName,
        byAvatar: oldest.createdByAvatar,
        title: oldest.title,
        restoreId: oldest.id,
        before: { title: "", content: null, board: null },
        after: { title: oldest.title, content: oldest.content, board: oldest.board },
        blocks: earlier.blocks,
        more: earlier.more,
        baseline: true,
      });
    }
  }

  return grouped.map((event, index) => ({
    id: `${event.baseline ? "base" : "v"}-${event.restoreId ?? "now"}-${index}`,
    restoreId: event.restoreId,
    title: event.title,
    createdAt: event.at,
    createdBy: event.by,
    createdByName: event.byName,
    createdByAvatar: event.byAvatar,
    baseline: Boolean(event.baseline),
    blocks: event.blocks,
    more: event.more,
  }));
}

type RawEvent = {
  at: string;
  tailAt: string;
  by: string | null;
  byName: string | null;
  byAvatar: string | null;
  title: string;
  restoreId: string | null;
  before: DocState;
  after: DocState;
  blocks?: HistoryBlock[];
  more?: number;
  baseline?: boolean;
};

function groupEvents(events: RawEvent[]): RawEvent[] {
  const out: RawEvent[] = [];
  for (const event of events) {
    const prev = out[out.length - 1];
    const gap = prev ? Date.parse(prev.tailAt) - Date.parse(event.at) : Infinity;
    if (prev && prev.by === event.by && gap >= 0 && gap <= GROUP_GAP_MS) {
      prev.before = event.before;
      prev.tailAt = event.at;
      continue;
    }
    out.push({ ...event, before: event.before, after: event.after });
  }
  return out;
}

function diffStates(before: DocState, after: DocState): { blocks: HistoryBlock[]; more: number } {
  const blocks: HistoryBlock[] = [];
  const more: More = { n: 0 };
  if ((before.title || "") !== (after.title || "")) {
    const spans = clipSpans(wordDiff(before.title || "", after.title || ""));
    if (spans.length > 0) pushBlock(blocks, { type: "title", spans }, more);
  }
  diffFlats(flattenDoc(before.content), flattenDoc(after.content), blocks, more);
  diffBoard(before.board, after.board, blocks, more);
  return { blocks, more: more.n };
}

function excerptState(state: DocState): { blocks: HistoryBlock[]; more: number } {
  const blocks: HistoryBlock[] = [];
  const more: More = { n: 0 };
  if (state.title.trim()) {
    pushBlock(blocks, { type: "title", spans: clipSpans([{ t: state.title }]) }, more);
  }
  for (const flat of flattenDoc(state.content)) {
    emitFlat(flat, "keep", blocks, more);
  }
  excerptBoard(state.board, blocks, more);
  return { blocks, more: more.n };
}

function pushBlock(blocks: HistoryBlock[], block: HistoryBlock, more: More) {
  if (blocks.length >= MAX_BLOCKS) more.n += 1;
  else blocks.push(block);
}

function flattenDoc(content: unknown): Flat[] {
  const out: Flat[] = [];
  for (const node of asNodes(content)) {
    const type = String(node.type ?? "");
    if (type === "bulletList" || type === "orderedList") {
      const items = childPieces(node).filter((item) => item.text.trim());
      if (items.length === 0) continue;
      out.push({
        type: "list",
        ordered: type === "orderedList",
        pieces: [],
        text: items.map((item) => item.text).join("\n"),
        items,
      });
      continue;
    }
    if (type === "taskList") {
      const contentNodes = Array.isArray(node.content) ? node.content : [];
      for (const child of contentNodes) {
        if (!child || typeof child !== "object") continue;
        const task = child as Record<string, unknown>;
        const pieces: Piece[] = [];
        collectPieces(task, pieces);
        const checked = Boolean((task.attrs as { checked?: unknown } | undefined)?.checked);
        out.push({ type: "todo", checked, pieces, text: piecesText(pieces) });
      }
      continue;
    }
    if (type === "codeBlock") {
      const pieces: Piece[] = [];
      collectPieces(node, pieces);
      const text = piecesText(pieces);
      const language = stringAttr(node, "language");
      out.push({
        type: "code",
        language,
        pieces,
        text,
        lines: text.split("\n"),
      });
      continue;
    }
    if (type === "horizontalRule") {
      out.push({ type: "rule", pieces: [], text: "" });
      continue;
    }
    if (type === "image") {
      out.push({ type: "image", pieces: [], text: "" });
      continue;
    }
    if (type === "embed") {
      const url = stringAttr(node, "url") ?? "";
      out.push({ type: "embed", pieces: url ? [{ t: url }] : [], text: url });
      continue;
    }
    const pieces: Piece[] = [];
    collectPieces(node, pieces);
    if (type === "promptBlock") {
      const prompt = stringAttr(node, "prompt");
      if (prompt) pieces.unshift({ t: prompt });
    }
    const text = piecesText(pieces);
    if (!text.trim() && type !== "blockquote") continue;
    if (type === "blockquote") {
      if (!text.trim()) continue;
      out.push({ type: "quote", pieces, text });
      continue;
    }
    if (type === "heading") {
      const level = Number((node.attrs as { level?: unknown } | undefined)?.level ?? 1) || 1;
      out.push({ type: "heading", level, pieces, text });
      continue;
    }
    if (type === "callout" || type === "promptBlock") {
      out.push({ type: "callout", pieces, text });
      continue;
    }
    out.push({ type: "paragraph", pieces, text });
  }
  return out;
}

function asNodes(content: unknown): Record<string, unknown>[] {
  if (Array.isArray(content)) {
    return content.filter((node) => node && typeof node === "object") as Record<string, unknown>[];
  }
  if (!content || typeof content !== "object") return [];
  const nodes = (content as Record<string, unknown>).content;
  if (!Array.isArray(nodes)) return [];
  return nodes.filter((node) => node && typeof node === "object") as Record<string, unknown>[];
}

function childPieces(node: Record<string, unknown>): { pieces: Piece[]; text: string }[] {
  const content = Array.isArray(node.content) ? node.content : [];
  const items: { pieces: Piece[]; text: string }[] = [];
  for (const child of content) {
    const pieces: Piece[] = [];
    collectPieces(child, pieces);
    items.push({ pieces, text: piecesText(pieces) });
  }
  return items;
}

function collectPieces(node: unknown, into: Piece[]) {
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (record.type === "text" && typeof record.text === "string") {
    const marks = Array.isArray(record.marks) ? record.marks : [];
    const link = marks.find(
      (mark) => mark && typeof mark === "object" && (mark as { type?: string }).type === "link",
    ) as { attrs?: { href?: string } } | undefined;
    const href = link?.attrs?.href;
    into.push(href && isSafeHref(href) ? { t: record.text, href } : { t: record.text });
    return;
  }
  if (Array.isArray(record.content)) {
    for (const child of record.content) collectPieces(child, into);
  }
}

function piecesText(pieces: Piece[]): string {
  return pieces.map((piece) => piece.t).join("");
}

function stringAttr(node: Record<string, unknown>, key: string): string | null {
  const attrs = node.attrs;
  if (!attrs || typeof attrs !== "object") return null;
  const value = (attrs as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function isSafeHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

function diffFlats(before: Flat[], after: Flat[], blocks: HistoryBlock[], more: More) {
  const ops = lcsOps(before, after, sameFlat);
  let dels: Flat[] = [];
  let adds: Flat[] = [];
  const flush = () => {
    pairFlats(dels, adds, blocks, more);
    dels = [];
    adds = [];
  };
  for (const op of ops) {
    if (op.op === "same") {
      flush();
      continue;
    }
    if (op.op === "del" && op.i !== undefined) dels.push(before[op.i]);
    if (op.op === "add" && op.j !== undefined) adds.push(after[op.j]);
  }
  flush();
}

function sameFlat(a: Flat, b: Flat): boolean {
  return (
    a.type === b.type &&
    a.level === b.level &&
    a.language === b.language &&
    a.ordered === b.ordered &&
    a.checked === b.checked &&
    a.text === b.text
  );
}

function pairFlats(dels: Flat[], adds: Flat[], blocks: HistoryBlock[], more: More) {
  const used = new Set<number>();
  for (const before of dels) {
    const index = adds.findIndex(
      (after, i) =>
        !used.has(i) &&
        after.type === before.type &&
        after.level === before.level &&
        after.language === before.language,
    );
    if (index === -1) {
      emitFlat(before, "del", blocks, more);
      continue;
    }
    used.add(index);
    emitEdit(before, adds[index], blocks, more);
  }
  adds.forEach((after, index) => {
    if (!used.has(index)) emitFlat(after, "add", blocks, more);
  });
}

function emitFlat(flat: Flat, mode: "add" | "del" | "keep", blocks: HistoryBlock[], more: More) {
  if (flat.type === "rule") {
    pushBlock(blocks, { type: "rule" }, more);
    return;
  }
  if (flat.type === "image") {
    pushBlock(blocks, { type: "image" }, more);
    return;
  }
  if (flat.type === "code") {
    const lines = (flat.lines ?? []).slice(0, 8).map((line) => [
      mode === "del" ? { t: line, m: "del" as const } : { t: line },
    ]);
    if (lines.length === 0) return;
    pushBlock(blocks, { type: "code", language: flat.language ?? null, lines }, more);
    if ((flat.lines?.length ?? 0) > 8) more.n += 1;
    return;
  }
  if (!flat.text.trim() && flat.type !== "embed") return;
  const mark = mode === "del" ? "del" : mode === "add" ? accentMark(flat.type) : undefined;
  if (flat.type === "list" && flat.items) {
    pushBlock(
      blocks,
      {
        type: "list",
        ordered: flat.ordered,
        items: flat.items.slice(0, 6).map((item) => piecesToSpans(item.pieces, mark)),
      },
      more,
    );
    if (flat.items.length > 6) more.n += flat.items.length - 6;
    return;
  }
  if (flat.type === "todo") {
    pushBlock(blocks, { type: "todo", checked: flat.checked, spans: piecesToSpans(flat.pieces, mark) }, more);
    return;
  }
  const type = blockType(flat.type);
  pushBlock(
    blocks,
    { type, level: flat.level, spans: clipSpans(piecesToSpans(flat.pieces, mark)) },
    more,
  );
}

function emitEdit(before: Flat, after: Flat, blocks: HistoryBlock[], more: More) {
  if (before.text === after.text && before.checked === after.checked) return;
  if (after.type === "code") {
    const lines = codeLines(before.lines ?? [], after.lines ?? []).slice(0, 8);
    if (!lines.some((line) => line.some((span) => span.m))) return;
    pushBlock(blocks, { type: "code", language: after.language ?? null, lines }, more);
    return;
  }
  if (after.type === "list") {
    const items = diffListItems(before.items ?? [], after.items ?? []);
    if (items.length === 0) return;
    pushBlock(blocks, { type: "list", ordered: after.ordered, items: items.slice(0, 6) }, more);
    if (items.length > 6) more.n += items.length - 6;
    return;
  }
  if (after.type === "todo") {
    const spans =
      before.text === after.text
        ? piecesToSpans(after.pieces)
        : clipSpans(wordDiff(before.text, after.text));
    pushBlock(blocks, { type: "todo", checked: after.checked, spans }, more);
    return;
  }
  const spans = clipSpans(linkedWordDiff(before, after));
  if (!spans.some((span) => span.m)) return;
  pushBlock(blocks, { type: blockType(after.type), level: after.level, spans }, more);
}

function linkedWordDiff(before: Flat, after: Flat): HistorySpan[] {
  const spans = wordDiff(before.text, after.text);
  const shared = spans.some((span) => !span.m && span.t.trim());
  if (shared) return spans;
  return [...piecesToSpans(before.pieces, "del"), ...piecesToSpans(after.pieces, accentMark(after.type))];
}

function blockType(type: string): HistoryBlock["type"] {
  if (
    type === "heading" ||
    type === "quote" ||
    type === "callout" ||
    type === "embed" ||
    type === "paragraph"
  ) {
    return type;
  }
  return "paragraph";
}

function accentMark(type: string): "add" | undefined {
  if (type === "quote" || type === "code" || type === "callout" || type === "image" || type === "embed") {
    return undefined;
  }
  return "add";
}

function piecesToSpans(pieces: Piece[], mark?: "add" | "del"): HistorySpan[] {
  const spans: HistorySpan[] = [];
  for (const piece of pieces) {
    if (!piece.t) continue;
    const span: HistorySpan = { t: piece.t };
    if (mark) span.m = mark;
    if (piece.href) span.href = piece.href;
    const prev = spans[spans.length - 1];
    if (prev && prev.m === span.m && prev.href === span.href) {
      prev.t += span.t;
      continue;
    }
    spans.push(span);
  }
  return spans;
}

function diffListItems(
  before: { pieces: Piece[]; text: string }[],
  after: { pieces: Piece[]; text: string }[],
): HistorySpan[][] {
  const ops = lcsOps(before, after, (a, b) => a.text === b.text);
  let dels: { pieces: Piece[]; text: string }[] = [];
  let adds: { pieces: Piece[]; text: string }[] = [];
  const out: HistorySpan[][] = [];
  const flush = () => {
    const used = new Set<number>();
    for (const item of dels) {
      const index = adds.findIndex((_, i) => !used.has(i));
      if (index === -1) {
        out.push(piecesToSpans(item.pieces, "del"));
        continue;
      }
      used.add(index);
      out.push(clipSpans(wordDiff(item.text, adds[index].text)));
    }
    adds.forEach((item, index) => {
      if (!used.has(index)) out.push(piecesToSpans(item.pieces, "add"));
    });
    dels = [];
    adds = [];
  };
  for (const op of ops) {
    if (op.op === "same") {
      flush();
      continue;
    }
    if (op.op === "del" && op.i !== undefined) dels.push(before[op.i]);
    if (op.op === "add" && op.j !== undefined) adds.push(after[op.j]);
  }
  flush();
  return out.filter((spans) => spans.length > 0);
}

function codeLines(before: string[], after: string[]): HistorySpan[][] {
  const ops = lcsOps(before, after, (a, b) => a === b);
  const lines: HistorySpan[][] = [];
  for (const op of ops) {
    if (lines.length >= 8) break;
    if (op.op === "same" && op.i !== undefined) lines.push([{ t: before[op.i] }]);
    if (op.op === "del" && op.i !== undefined) lines.push([{ t: before[op.i], m: "del" }]);
    if (op.op === "add" && op.j !== undefined) lines.push([{ t: after[op.j], m: "add" }]);
  }
  return lines;
}

function wordDiff(before: string, after: string): HistorySpan[] {
  if (before === after) return before ? [{ t: before }] : [];
  if (!before) return [{ t: after, m: "add" }];
  if (!after) return [{ t: before, m: "del" }];
  const left = tokenize(before);
  const right = tokenize(after);
  if (left.length > 80 || right.length > 80 || left.length * right.length > 4000) {
    return [
      { t: before, m: "del" },
      { t: after, m: "add" },
    ];
  }
  const ops = lcsOps(left, right, (a, b) => a === b);
  const spans: HistorySpan[] = [];
  for (const op of ops) {
    if (op.op === "same" && op.i !== undefined) pushSpan(spans, { t: left[op.i] });
    if (op.op === "del" && op.i !== undefined) pushSpan(spans, { t: left[op.i], m: "del" });
    if (op.op === "add" && op.j !== undefined) pushSpan(spans, { t: right[op.j], m: "add" });
  }
  return spans;
}

function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter((part) => part.length > 0);
}

function pushSpan(spans: HistorySpan[], span: HistorySpan) {
  const prev = spans[spans.length - 1];
  if (prev && prev.m === span.m && !prev.href && !span.href) {
    prev.t += span.t;
    return;
  }
  spans.push(span);
}

function clipSpans(spans: HistorySpan[]): HistorySpan[] {
  const out: HistorySpan[] = [];
  let used = 0;
  for (const span of spans) {
    if (used >= MAX_SPAN) break;
    if (span.t.length + used <= MAX_SPAN) {
      out.push(span);
      used += span.t.length;
      continue;
    }
    const cut = span.t.slice(0, MAX_SPAN - used).trimEnd();
    if (cut) out.push({ ...span, t: `${cut}…` });
    used = MAX_SPAN;
  }
  return out;
}

function lcsOps<T>(left: T[], right: T[], eq: (a: T, b: T) => boolean): LcsOp[] {
  const n = left.length;
  const m = right.length;
  if (n * m > 25000) {
    const ops: LcsOp[] = [];
    const shared = Math.min(n, m);
    for (let i = 0; i < shared; i += 1) {
      if (eq(left[i], right[i])) ops.push({ op: "same", i, j: i });
      else {
        ops.push({ op: "del", i });
        ops.push({ op: "add", j: i });
      }
    }
    for (let i = shared; i < n; i += 1) ops.push({ op: "del", i });
    for (let j = shared; j < m; j += 1) ops.push({ op: "add", j });
    return ops;
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = eq(left[i], right[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: LcsOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(left[i], right[j])) {
      ops.push({ op: "same", i, j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: "del", i });
      i += 1;
    } else {
      ops.push({ op: "add", j });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ op: "del", i });
    i += 1;
  }
  while (j < m) {
    ops.push({ op: "add", j });
    j += 1;
  }
  return ops;
}

type ShapeHit = {
  id: string;
  kind: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  look: string;
};

function diffBoard(before: unknown, after: unknown, blocks: HistoryBlock[], more: More) {
  const older = boardShapes(before);
  const newer = boardShapes(after);
  const detailed: HistoryBlock[] = [];
  const silent: { action: "add" | "del" | "move"; kind: string }[] = [];

  for (const [id, shape] of newer) {
    const prev = older.get(id);
    if (!prev) {
      if (shape.text) {
        detailed.push({
          type: "board",
          action: "add",
          shape: shape.kind,
          spans: clipSpans([{ t: shape.text, m: "add" }]),
        });
      } else silent.push({ action: "add", kind: shape.kind });
      continue;
    }
    if (shape.text !== prev.text) {
      detailed.push({
        type: "board",
        action: "edit",
        shape: shape.kind,
        spans: clipSpans(wordDiff(prev.text, shape.text)),
      });
      continue;
    }
    const moved =
      Math.hypot(shape.x - prev.x, shape.y - prev.y) > 8 ||
      Math.abs(shape.w - prev.w) > 6 ||
      Math.abs(shape.h - prev.h) > 6;
    if (shape.look !== prev.look) {
      detailed.push(
        shape.text
          ? { type: "board", action: "edit", shape: shape.kind, spans: clipSpans([{ t: shape.text }]) }
          : { type: "board", action: "edit", shape: shape.kind },
      );
      continue;
    }
    if (moved) silent.push({ action: "move", kind: shape.kind });
  }

  for (const [id, shape] of older) {
    if (newer.has(id)) continue;
    if (shape.text) {
      detailed.push({
        type: "board",
        action: "del",
        shape: shape.kind,
        spans: clipSpans([{ t: shape.text, m: "del" }]),
      });
    } else silent.push({ action: "del", kind: shape.kind });
  }

  for (const block of detailed) pushBlock(blocks, block, more);

  const buckets = new Map<string, { action: "add" | "del" | "move"; kind: string; count: number }>();
  for (const item of silent) {
    const key = `${item.action}:${item.kind}`;
    const bucket = buckets.get(key) ?? { action: item.action, kind: item.kind, count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) {
    pushBlock(
      blocks,
      {
        type: "board",
        action: bucket.action,
        shape: bucket.kind,
        count: bucket.count > 1 ? bucket.count : undefined,
      },
      more,
    );
  }
}

function excerptBoard(board: unknown, blocks: HistoryBlock[], more: More) {
  const list = [...boardShapes(board).values()];
  const withText = list.filter((shape) => shape.text.trim());
  const shown = (withText.length > 0 ? withText : list).slice(0, 4);
  for (const shape of shown) {
    pushBlock(
      blocks,
      {
        type: "board",
        shape: shape.kind,
        spans: shape.text ? clipSpans([{ t: shape.text }]) : undefined,
      },
      more,
    );
  }
  const rest = list.length - shown.length;
  if (rest > 0) more.n += rest;
}

function boardShapes(board: unknown): Map<string, ShapeHit> {
  const store = storeOf(board);
  const out = new Map<string, ShapeHit>();
  if (!store) return out;
  for (const [key, rec] of Object.entries(store)) {
    if (!rec || typeof rec !== "object") continue;
    const record = rec as Record<string, unknown>;
    if (record.typeName !== "shape") continue;
    const id = typeof record.id === "string" ? record.id : key;
    const type = typeof record.type === "string" ? record.type : "shape";
    const props =
      record.props && typeof record.props === "object"
        ? (record.props as Record<string, unknown>)
        : {};
    const kind = shapeKind(type);
    out.set(id, {
      id,
      kind,
      text: shapeText(props),
      x: numberOf(record.x),
      y: numberOf(record.y),
      w: numberOf(props.w),
      h: numberOf(props.h),
      look: lookOf(type, props),
    });
  }
  return out;
}

function storeOf(board: unknown): Record<string, unknown> | null {
  if (!board || typeof board !== "object") return null;
  const root = board as Record<string, unknown>;
  const doc = root.document;
  if (doc && typeof doc === "object") {
    const store = (doc as Record<string, unknown>).store;
    if (store && typeof store === "object") return store as Record<string, unknown>;
  }
  if (root.store && typeof root.store === "object") return root.store as Record<string, unknown>;
  return null;
}

function shapeText(props: Record<string, unknown>): string {
  for (const key of ["text", "label", "plainText"]) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  for (const key of ["richText", "content"]) {
    const value = props[key];
    if (!value || typeof value !== "object") continue;
    const pieces: Piece[] = [];
    collectPieces(value, pieces);
    const text = piecesText(pieces).trim();
    if (text) return text;
  }
  return "";
}

function shapeKind(type: string): string {
  if (type === "geo" || type.startsWith("geo:")) return "geo";
  if (type === "freedraw" || type === "highlight" || type === "draw" || type === "stroke") return "draw";
  if (type === "arrow" || type === "line" || type === "note" || type === "text" || type === "image" || type === "frame") {
    return type;
  }
  return "shape";
}

function lookOf(type: string, props: Record<string, unknown>): string {
  const keys = ["color", "fill", "fillColor", "geo", "font", "size", "align", "dash", "fontSize"];
  return `${type}|${keys.map((key) => JSON.stringify(props[key] ?? null)).join(",")}`;
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
