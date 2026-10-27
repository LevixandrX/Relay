export type ActivityNode = { type: string; attrs?: Record<string, unknown>; content?: ActivityNode[]; text?: string; marks?: unknown[] };
export type BlockActivityInfo = { createdBy: string | null; createdAt: string | null; editedBy: string; editedAt: string };
export function activityBlocks(doc: ActivityNode) {
  const blocks: { id: string | null; signature: string }[] = [];
  const clean = (node: ActivityNode): ActivityNode => {
    const { blockId: _id, ...raw } = node.attrs ?? {};
    const attrs = Object.fromEntries(Object.entries(raw).filter(([key, value]) => value != null && !(key === "blockIndent" && value === 0)));
    return { ...node, attrs: Object.keys(attrs).length ? attrs : undefined, content: node.content?.map(clean) };
  };
  const walk = (node: ActivityNode) => {
    if (node.type !== "doc" && node.type !== "text" && node.type !== "hardBreak") blocks.push({ id: typeof node.attrs?.blockId === "string" ? node.attrs.blockId : null, signature: JSON.stringify(clean(node)) });
    node.content?.forEach(walk);
  };
  walk(doc); return blocks;
}
export function changedActivityBlocks(before: ActivityNode, after: ActivityNode) {
  const old = activityBlocks(before), next = activityBlocks(after);
  const ids = new Map(old.filter((n) => n.id).map((n) => [n.id!, n.signature]));
  const untracked = new Map<string, number>();
  old.filter((n) => !n.id).forEach((n) => untracked.set(n.signature, (untracked.get(n.signature) ?? 0) + 1));
  return next.flatMap((n) => {
    if (!n.id || ids.get(n.id) === n.signature) return [];
    if (!ids.has(n.id) && (untracked.get(n.signature) ?? 0) > 0) { untracked.set(n.signature, untracked.get(n.signature)! - 1); return []; }
    return [{ id: n.id, created: !ids.has(n.id) && !old.some((o) => !o.id) }];
  });
}
