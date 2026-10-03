"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useState } from "react";
import { Callout, PromptBlock } from "./extensions";
import type { Doc } from "@/domain/blocks/schema";
import { SlashMenu } from "./slash-menu";
import {
  ActivityFocusExtension,
  focusEditorActivity,
  type ActivityTextBlockType,
} from "./activity-focus";

type Props = {
  content: Doc;
  editable?: boolean;
  onChange?: (doc: Doc) => void;
  onSlashUsed?: () => void;
  onRunPrompt?: (prompt: string) => Promise<void>;
  focusPhrases?: string[];
  focusBlockType?: ActivityTextBlockType;
  onActivityFocusDismiss?: () => void;
};

export function BlockEditor({
  content,
  editable = true,
  onChange,
  onSlashUsed,
  onRunPrompt,
  focusPhrases,
  focusBlockType,
  onActivityFocusDismiss,
}: Props) {
  const [slash, setSlash] = useState<{ top: number; left: number; query: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onRunRef = useRef(onRunPrompt);
  onRunRef.current = onRunPrompt;
  const onFocusDismissRef = useRef(onActivityFocusDismiss);
  onFocusDismissRef.current = onActivityFocusDismiss;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Заголовок";
          return "Пиши или нажми «/» для блоков…";
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Callout,
      ActivityFocusExtension,
      PromptBlock.configure({
        onRun: (prompt: string) => {
          void onRunRef.current?.(prompt);
        },
      }),
    ],
    content: content as object,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getJSON() as Doc);
      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 40), from, "\n", "\n");
      const match = textBefore.match(/(?:^|\n)\/([^\s/]*)$/);
      if (match && editable) {
        const coords = ed.view.coordsAtPos(from);
        const rect = wrapRef.current?.getBoundingClientRect();
        setSlash({
          top: coords.bottom - (rect?.top ?? 0) + 8,
          left: coords.left - (rect?.left ?? 0),
          query: match[1] ?? "",
        });
      } else {
        setSlash(null);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(content);
    if (current !== next) {
      editor.commands.setContent(content as object);
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor || !focusPhrases?.length) return;
    let dispose: () => void = () => {};
    const frame = requestAnimationFrame(() => {
      dispose = focusEditorActivity(editor, focusPhrases, focusBlockType, () => onFocusDismissRef.current?.());
    });
    return () => {
      cancelAnimationFrame(frame);
      dispose();
    };
  }, [content, editor, focusPhrases, focusBlockType]);

  if (!editor) return <div className="relay-editor-skeleton" />;

  return (
    <div className="relay-editor" ref={wrapRef}>
      <EditorContent editor={editor} />
      {slash && (
        <SlashMenu
          top={slash.top}
          left={slash.left}
          query={slash.query}
          onClose={() => setSlash(null)}
          onPick={(command) => {
            onSlashUsed?.();
            const { from } = editor.state.selection;
            const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, "\n", "\n");
            const match = textBefore.match(/(?:^|\n)(\/[^\s/]*)$/);
            if (match) {
              editor
                .chain()
                .focus()
                .deleteRange({ from: from - match[1].length, to: from })
                .run();
            }
            command(editor);
            setSlash(null);
          }}
        />
      )}
    </div>
  );
}
