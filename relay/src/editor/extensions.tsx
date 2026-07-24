"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type ReactNodeViewProps,
} from "@tiptap/react";

function CalloutView(props: ReactNodeViewProps) {
  const emoji = String(props.node.attrs.emoji ?? "💡");
  return (
    <NodeViewWrapper
      className={`relay-callout ${props.selected ? "is-selected" : ""}`}
      data-emoji={emoji}
    >
      <button
        type="button"
        className="relay-callout-emoji"
        contentEditable={false}
        onClick={() => {
          const next = emoji === "💡" ? "⚠️" : emoji === "⚠️" ? "✅" : "💡";
          props.updateAttributes({ emoji: next });
        }}
      >
        {emoji}
      </button>
      <NodeViewContent className="relay-callout-body" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      emoji: { default: "💡" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "relay-callout" }),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

function PromptView(props: ReactNodeViewProps) {
  const prompt = String(props.node.attrs.prompt ?? "");
  const status = String(props.node.attrs.status ?? "idle");
  const running = status === "running";
  const onRun = (
    props.extension.options as { onRun?: (prompt: string) => void }
  ).onRun;

  return (
    <NodeViewWrapper className={`relay-prompt ${props.selected ? "is-selected" : ""}`}>
      <div className="relay-prompt-label" contentEditable={false}>
        Live Prompt
      </div>
      <textarea
        className="relay-prompt-input"
        value={prompt}
        disabled={!props.editor.isEditable || running}
        rows={2}
        placeholder="Суммируй эту страницу в 3 пункта…"
        onChange={(e) => props.updateAttributes({ prompt: e.target.value })}
      />
      <div className="relay-prompt-actions" contentEditable={false}>
        <button
          type="button"
          className="relay-btn relay-btn-accent"
          disabled={!props.editor.isEditable || running || !prompt}
          onClick={() => onRun?.(prompt)}
        >
          {running ? "Думаем…" : "Запустить"}
        </button>
        <span className="relay-prompt-hint">
          Читает структуру страницы — работает и без API-ключа
        </span>
      </div>
    </NodeViewWrapper>
  );
}

export const PromptBlock = Node.create({
  name: "promptBlock",
  group: "block",
  atom: true,
  addOptions() {
    return {
      onRun: undefined as undefined | ((prompt: string) => void),
    };
  },
  addAttributes() {
    return {
      prompt: { default: "" },
      status: { default: "idle" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="promptBlock"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "promptBlock" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PromptView);
  },
});
