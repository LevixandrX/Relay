import { Node, mergeAttributes } from "@tiptap/core";
export const BlockCallout = Node.create({
  name: "callout", group: "block", content: "block+", defining: true,
  addAttributes() { return { emoji: { default: "💡" } }; },
  parseHTML() { return [{ tag: 'div[data-type="callout"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout", "data-emoji": HTMLAttributes.emoji, class: "relay-block-callout" }), 0];
  },
});
