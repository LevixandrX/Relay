import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useState } from "react";
import type { Doc } from "../lib/types";

const SLASH_ITEMS: {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  run: (editor: Editor) => void;
}[] = [
  {
    id: "text",
    label: "Текст",
    hint: "Обычный абзац",
    keywords: "paragraph текст",
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h1",
    label: "Заголовок 1",
    hint: "Крупный раздел",
    keywords: "heading h1 заголовок",
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Заголовок 2",
    hint: "Подраздел",
    keywords: "heading h2",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "todo",
    label: "Чеклист",
    hint: "Задачи",
    keywords: "todo task чеклист",
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: "bullet",
    label: "Список",
    hint: "Маркированный",
    keywords: "bullet list список",
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "code",
    label: "Код",
    hint: "Фрагмент кода",
    keywords: "code код",
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "quote",
    label: "Цитата",
    hint: "Выделить мысль",
    keywords: "quote цитата",
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
];

type Props = {
  content: Doc;
  editable?: boolean;
  onChange?: (doc: Doc) => void;
};

export function BlockEditor({ content, editable = true, onChange }: Props) {
  const [slash, setSlash] = useState<{ top: number; left: number; query: string } | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Заголовок";
          return "Пиши или нажми «/» для блоков…";
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
    ? SLASH_ITEMS.filter((i) =>
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
