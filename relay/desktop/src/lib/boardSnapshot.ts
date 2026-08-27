import type { DiffSource, Snapshot } from "@quickdrawjs/core";

/** Quickdraw snapshot: { document: { store: { id: record } } } */
export function parseQuickdrawSnapshot(raw: unknown): Snapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const root = raw as Record<string, unknown>;
  if ("session" in root) return undefined;

  const doc = root.document;
  if (!doc || typeof doc !== "object") return undefined;
  const docObj = doc as Record<string, unknown>;
  if ("schema" in docObj) return undefined;

  const store = docObj.store;
  if (!store || typeof store !== "object") return undefined;

  for (const rec of Object.values(store as Record<string, unknown>)) {
    if (!rec || typeof rec !== "object") return undefined;
    const r = rec as Record<string, unknown>;

    if (r.typeName === "asset") {
      if (typeof r.w !== "number" || typeof r.h !== "number" || typeof r.src !== "string") {
        return undefined;
      }
      continue;
    }

    if (r.typeName !== "shape") return undefined;
    if (typeof r.type !== "string" || typeof r.x !== "number" || typeof r.y !== "number") {
      return undefined;
    }

    const props = r.props;
    if (!props || typeof props !== "object") return undefined;
    const p = props as Record<string, unknown>;

    if (r.type === "geo" || r.type === "text" || r.type === "note" || r.type === "image") {
      if (typeof p.w !== "number" || typeof p.h !== "number") return undefined;
    }
    if (r.type === "image" && typeof p.assetId !== "string") return undefined;
  }

  return raw as Snapshot;
}

export function loadBoardSnapshot(
  store: { loadSnapshot: (snap: Snapshot, source?: DiffSource) => void },
  raw: unknown,
) {
  const snap = parseQuickdrawSnapshot(raw);
  if (!snap) return false;
  try {
    store.loadSnapshot(snap, "remote");
    return true;
  } catch {
    return false;
  }
}
