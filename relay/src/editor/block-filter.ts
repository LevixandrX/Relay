import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
type Hint = { from: number; label: string; slash?: boolean } | null;
const key = new PluginKey<Hint>("relayBlockFilter");
export const BlockFilterExtension = Extension.create({
  name: "relayBlockFilter",
  addProseMirrorPlugins() {
    return [new Plugin<Hint>({
      key,
      state: {
        init: () => null,
        apply(transaction, previous) {
          const next = transaction.getMeta(key) as Hint | undefined;
          if (next !== undefined) return next;
          if (!previous) return null;
          const mapped = transaction.mapping.mapResult(previous.from);
          return mapped.deleted ? null : { ...previous, from: mapped.pos };
        },
      },
      props: {
        decorations(state) {
          const hint = key.getState(state);
          const node = hint && state.doc.nodeAt(hint.from);
          if (!hint || !node?.isTextblock || (hint.slash ? node.textContent !== '/' : node.content.size)) return null;
          return DecorationSet.create(state.doc, [Decoration.node(hint.from, hint.from + node.nodeSize, { class: "editor-inline-filter", "data-filter-placeholder": hint.label, 'data-filter-slash':String(Boolean(hint.slash)) })]);
        },
      },
    })];
  },
});
export function setBlockFilterHint(editor: Editor, hint: Hint) {
  if (!editor.isDestroyed && editor.extensionManager.extensions.some((extension) => extension.name === "relayBlockFilter")) editor.view.dispatch(editor.state.tr.setMeta(key, hint).setMeta("addToHistory", false));
}
