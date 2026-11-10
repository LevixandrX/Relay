import { LoadingIndicator } from "@relay-ui/LoadingIndicator";
import {editorPlaceholder} from '@relay-editor/editor-placeholder';
import { BlockColumns, BlockColumn } from "@relay-editor/block-columns";
import { BlockAppearance, INITIALIZE_BLOCK_IDS } from "@relay-editor/block-appearance";
import { CommentAnchors } from "@relay-editor/comment-anchor";
import type { CommentContext } from "@relay-editor/comment-types";
import { usePageResume } from "@relay-editor/use-page-resume";
import {richExtensions} from '@relay-editor/rich-blocks';
import {CodeBlock} from '@relay-editor/code-block';
import type {EditorResources} from '@relay-editor/rich-blocks';
import { BlockFilterExtension } from "@relay-editor/block-filter";
import { EditorTools } from "@relay-editor/EditorTools";
import { BlockCallout } from "@relay-editor/block-callout";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import type { Doc } from "../lib/types";
import {
  ActivityFocusExtension,
  focusEditorActivity,
  type ActivityTextBlockType,
} from "@relay-editor-focus";

type Props = {
  content: Doc;
  getDraft?: () => Doc | undefined;
  comments?: CommentContext;
  resources?: EditorResources;
  editable?: boolean;
  onChange?: (readDoc: () => Doc, options: { initializing: boolean }) => void;
  focusPhrases?: string[];
  focusBlockType?: ActivityTextBlockType;
  onActivityFocusDismiss?: () => void;
};

export function BlockEditor({
  content,
  getDraft,
  comments,
  resources,
  editable = true,
  onChange,
  focusPhrases,
  focusBlockType,
  onActivityFocusDismiss,
}: Props) {
  const t = useTranslations("editorTools");
  const [initialContent] = useState(() => getDraft?.() ?? content);
  const externalContent = useRef(content);
  const wrapRef = useRef<HTMLDivElement>(null);
  const resourcesRef=useRef(resources);resourcesRef.current=resources;
  const commentsRef=useRef(comments);commentsRef.current=comments;
  const onFocusDismissRef = useRef(onActivityFocusDismiss);
  onFocusDismissRef.current = onActivityFocusDismiss;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ link: false, codeBlock:false, heading: { levels: [1, 2, 3, 4] } }),
      CodeBlock,
      ...richExtensions(()=>resourcesRef.current),
      Placeholder.configure({showOnlyCurrent:false,includeChildren:true,placeholder:args=>editorPlaceholder(args,t)}),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      ActivityFocusExtension,
      BlockFilterExtension,
      BlockColumns.configure({ resizeLabel: t("resizeColumns"),resizeStartLabel:t('resizeRowStart'),resizeEndLabel:t('resizeRowEnd') }),
      BlockColumn,
      BlockAppearance,
      CommentAnchors,
      BlockCallout.configure({getResources:()=>resourcesRef.current,getComments:()=>commentsRef.current}),
    ],
    content: initialContent as object,
    onUpdate: ({ editor: ed, transaction, appendedTransactions }) => {
      if (!transaction.docChanged && !appendedTransactions.some((tr) => tr.docChanged)) return;
      const snapshot = ed.state.doc;
      onChange?.(() => snapshot.toJSON() as Doc, { initializing: transaction.getMeta(INITIALIZE_BLOCK_IDS) === true });
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || externalContent.current === content) return;
    externalContent.current = content;
    const next=editor.schema.nodeFromJSON(content);
    if(editor.state.doc.eq(next))return;
    // React node views mount with flushSync; update them after React's commit.
    const frame=requestAnimationFrame(()=>{if(!editor.isDestroyed&&!editor.state.doc.eq(next))editor.commands.setContent(content as object, {emitUpdate:false});});
    return()=>cancelAnimationFrame(frame);
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

  if (!editor) return <LoadingIndicator centered />;

  return (
    <div className="relay-editor" data-block-tools={editable} ref={wrapRef}>
      <EditorTools editor={editor} container={wrapRef} editable={editable} comments={comments} resources={resources} />
      <EditorContent editor={editor} />
    </div>
  );
}
