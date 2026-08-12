import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import type { Doc } from "../lib/types";

type Props = {
  content: Doc;
  editable?: boolean;
  onChange?: (doc: Doc) => void;
};

export function BlockEditor({ content, editable = true, onChange }: Props) {
  const t = useTranslations("desktop");
  const [slash, setSlash] = useState<{ top: number; left: number; query: string } | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  const slashItems = useMemo(
    () =>
      [
        {
          id: "text",
          label: t("slashText"),
          hint: t("slashTextHint"),
          keywords: "paragraph текст text",
          run: (e: Editor) => e.chain().focus().setParagraph().run(),
        },
        {
          id: "h1",
          label: t("slashH1"),
          hint: t("slashH1Hint"),
          keywords: "heading h1 заголовок",
          run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          id: "h2",
          label: t("slashH2"),
          hint: t("slashH2Hint"),
          keywords: "heading h2",
          run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          id: "todo",
          label: t("slashTodo"),
          hint: t("slashTodoHint"),
          keywords: "todo task чеклист checklist",
          run: (e: Editor) => e.chain().focus().toggleTaskList().run(),
        },
        {
          id: "bullet",
          label: t("slashBullet"),
          hint: t("slashBulletHint"),
          keywords: "bullet list список",
          run: (e: Editor) => e.chain().focus().toggleBulletList().run(),
        },
        {
          id: "code",
          label: t("slashCode"),
          hint: t("slashCodeHint"),
          keywords: "code код",
          run: (e: Editor) => e.chain().focus().toggleCodeBlock().run(),
        },
        {
          id: "quote",
          label: t("slashQuote"),
          hint: t("slashQuoteHint"),
          keywords: "quote цитата",
          run: (e: Editor) => e.chain().focus().toggleBlockquote().run(),
        },
      ] as const,
    [t],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return t("editorPhHeading");
          return t("editorPhBody");
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
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

  if (!editor) return <div className="relay-editor-skeleton" />;

  const filtered = slash
    ? slashItems.filter((i) =>
        `${i.label} ${i.keywords}`.toLowerCase().includes(slash.query.toLowerCase()),
      )
    : [];

  return (
    <div className="relay-editor" ref={wrapRef}>
      <EditorContent editor={editor} />
      {slash && filtered.length > 0 && (
        <div className="slash-menu" style={{ top: slash.top, left: slash.left }}>
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="slash-item"
              onMouseDown={(e) => {
                e.preventDefault();
                const { from } = editor.state.selection;
                const textBefore = editor.state.doc.textBetween(
                  Math.max(0, from - 40),
                  from,
                  "\n",
                  "\n",
                );
                const match = textBefore.match(/(?:^|\n)(\/[^\s/]*)$/);
                if (match) {
                  editor
                    .chain()
                    .focus()
                    .deleteRange({ from: from - match[1].length, to: from })
                    .run();
                }
                item.run(editor);
                setSlash(null);
              }}
            >
              <strong>{item.label}</strong>
              <span className="muted">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
