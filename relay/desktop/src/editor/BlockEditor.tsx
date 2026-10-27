import { BlockColumns, BlockColumn } from "@relay-editor/block-columns";
import { BlockAppearance } from "@relay-editor/block-appearance";
import { CommentAnchors } from "@relay-editor/comment-anchor";
import type { CommentContext } from "@relay-editor/comment-types";
import { usePageResume } from "@relay-editor/use-page-resume";
import { BlockFilterExtension } from "@relay-editor/block-filter";
import { EditorTools } from "@relay-editor/EditorTools";
import { BlockCallout } from "@relay-editor/block-callout";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import type { Doc } from "../lib/types";
import {
  ActivityFocusExtension,
  focusEditorActivity,
  type ActivityTextBlockType,
} from "@relay-editor-focus";

type Props = {
  content: Doc;
  comments?: CommentContext;
  editable?: boolean;
  onChange?: (doc: Doc) => void;
  focusPhrases?: string[];
  focusBlockType?: ActivityTextBlockType;
  onActivityFocusDismiss?: () => void;
};

export function BlockEditor({
  content,
  comments,
  editable = true,
  onChange,
  focusPhrases,
  focusBlockType,
  onActivityFocusDismiss,
}: Props) {
  const t = useTranslations("editorTools");
  const wrapRef = useRef<HTMLDivElement>(null);
  const onFocusDismissRef = useRef(onActivityFocusDismiss);
  onFocusDismissRef.current = onActivityFocusDismiss;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return t("headingPlaceholder");
          return t("placeholder");
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      ActivityFocusExtension,
      BlockFilterExtension,
      BlockColumns.configure({ resizeLabel: t("resizeColumns"),resizeStartLabel:t('resizeRowStart'),resizeEndLabel:t('resizeRowEnd') }),
      BlockColumn,
      BlockAppearance,
      CommentAnchors,
      BlockCallout,
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
      <EditorTools editor={editor} container={wrapRef} editable={editable} comments={comments} />
      <EditorContent editor={editor} />
    </div>
  );
}
