import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type ActivityTextBlockType =
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

type FocusDecoration = { kind: "node"; from: number; to: number };

const activityFocusKey = new PluginKey<DecorationSet>("relayActivityFocus");

export const ActivityFocusExtension = Extension.create({
  name: "relayActivityFocus",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: activityFocusKey,
        state: {
          init: () => DecorationSet.empty,
          apply(transaction, previous) {
            const next = transaction.getMeta(activityFocusKey) as FocusDecoration[] | null | undefined;
            if (next === null) return DecorationSet.empty;
            if (next) {
              return DecorationSet.create(
                transaction.doc,
                next.map((item) =>
                  Decoration.node(item.from, item.to, {
                    class: "relay-activity-focus-block",
                    "data-activity-selected": "true",
                  }),
                ),
              );
            }
            return previous.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return activityFocusKey.getState(state) ?? null;
          },
        },
      }),
    ];
  },
});

const NODE_TYPES: Partial<Record<ActivityTextBlockType, string[]>> = {
  heading: ["heading"],
  quote: ["blockquote"],
  code: ["codeBlock"],
  paragraph: ["paragraph"],
  list: ["bulletList", "orderedList"],
  todo: ["taskList"],
  callout: ["callout", "promptBlock"],
  image: ["image"],
  embed: ["embed"],
  rule: ["horizontalRule"],
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function focusEditorActivity(
  editor: Editor,
  phrases: string[],
  blockType?: ActivityTextBlockType,
  onDismiss?: () => void,
) {
  const candidates = phrases.map(normalize).filter(Boolean);
  if (candidates.length === 0) return () => undefined;

  const expected = blockType ? NODE_TYPES[blockType] : undefined;
  let target: { from: number; to: number } | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (target) return false;
    if (node.isText) return false;
    if (expected?.length && !expected.includes(node.type.name)) return true;
    if (!expected?.length && !node.isTextblock) return true;
    const text = normalize(node.textContent);
    if (!text || !candidates.some((phrase) => text.includes(phrase))) return true;
    target = { from: pos, to: pos + node.nodeSize };
    return false;
  });

  // Older activity rows can lack block metadata. Keep a semantic fallback so
  // they still navigate, but always decorate the whole text block.
  if (!target) {
    editor.state.doc.descendants((node, pos) => {
      if (target || !node.isTextblock) return !target;
      const text = normalize(node.textContent);
      if (!text || !candidates.some((phrase) => text.includes(phrase))) return true;
      target = { from: pos, to: pos + node.nodeSize };
      return false;
    });
  }

  if (!target) return () => undefined;
  const focus = target as { from: number; to: number };
  editor.view.dispatch(
    editor.state.tr.setMeta(activityFocusKey, [
      { kind: "node", from: focus.from, to: focus.to } satisfies FocusDecoration,
    ]),
  );

  requestAnimationFrame(() => {
    const dom = editor.view.nodeDOM(focus.from);
    const block = dom instanceof HTMLElement ? dom : dom?.parentElement;
    if (!block) return;
    const viewport = block.closest<HTMLElement>(".overlay-scroll-target") ?? editor.view.dom.parentElement;
    const blockRect = block.getBoundingClientRect();
    const viewportRect = viewport?.getBoundingClientRect();
    if (
      !viewportRect ||
      blockRect.top < viewportRect.top + 48 ||
      blockRect.bottom > viewportRect.bottom - 48
    ) {
      block.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  const clearSelection = () => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(activityFocusKey, null));
  };
  const dismiss = () => {
    clearSelection();
    onDismiss?.();
  };
  editor.view.dom.addEventListener("pointerdown", dismiss, { once: true });
  editor.view.dom.addEventListener("keydown", dismiss, { once: true });
  return () => {
    editor.view.dom.removeEventListener("pointerdown", dismiss);
    editor.view.dom.removeEventListener("keydown", dismiss);
    clearSelection();
  };
}
