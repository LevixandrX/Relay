"use client";
import { BlockColumns, BlockColumn } from "./block-columns";
import { BlockAppearance } from "./block-appearance";
import { CommentAnchors } from "./comment-anchor";
import type { CommentContext } from "./comment-types";
import { usePageResume } from "./use-page-resume";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useRef } from "react";
import { PromptBlock } from "./extensions";
import type { Doc } from "@/domain/blocks/schema";
import { BlockFilterExtension } from "./block-filter";
import { EditorTools } from "./EditorTools";
import { BlockCallout } from "./block-callout";
import { useTranslations } from "use-intl";
import {
  ActivityFocusExtension,
  focusEditorActivity,
  type ActivityTextBlockType,
} from "./activity-focus";

type Props = {
  content: Doc;
  comments?: CommentContext;
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
  comments,
  editable = true,
  onChange,
  onSlashUsed,
  onRunPrompt,
  focusPhrases,
  focusBlockType,
  onActivityFocusDismiss,
}: Props) {
  const t = useTranslations("editorTools");
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
        link: false, heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => node.type.name === "heading" ? t("headingPlaceholder") : t("placeholder"),
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      BlockCallout,
      ActivityFocusExtension,
      BlockFilterExtension,
      BlockColumns.configure({ resizeLabel: t("resizeColumns"),resizeStartLabel:t('resizeRowStart'),resizeEndLabel:t('resizeRowEnd') }),
      BlockColumn,
      BlockAppearance,
      CommentAnchors,
      PromptBlock.configure({
        onRun: (prompt: string) => {
          void onRunRef.current?.(prompt);
        },
      }),
    ],
    content: content as object,
    onUpdate: ({ editor: ed }) => { onChange?.(ed.getJSON() as Doc); },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    // Normalize schema defaults before comparing, so an equivalent document
    // doesn't reset the selection immediately after restoring it.
    if (!editor.state.doc.eq(editor.schema.nodeFromJSON(content))) {
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

  usePageResume(editor, comments, Boolean(focusPhrases?.length));

  if (!editor) return <div className="relay-editor-skeleton" />;

  return (
    <div className="relay-editor" data-block-tools={editable} ref={wrapRef}>
      <EditorTools editor={editor} container={wrapRef} editable={editable} comments={comments} onSlashUsed={onSlashUsed} allowPrompt={Boolean(onRunPrompt)} />
      <EditorContent editor={editor} />
    </div>
  );
}
