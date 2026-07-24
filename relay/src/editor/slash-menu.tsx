"use client";

import type { Editor } from "@tiptap/react";

const ITEMS: {
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
  {
    id: "callout",
    label: "Выноска",
    hint: "Важная заметка",
    keywords: "callout tip выноска",
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: "callout",
          attrs: { emoji: "💡" },
          content: [{ type: "paragraph" }],
        })
        .run(),
  },
  {
    id: "prompt",
    label: "Live Prompt",
    hint: "Преобразовать страницу",
    keywords: "prompt ai live",
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: "promptBlock",
          attrs: {
            prompt: "Суммируй эту страницу в 3 коротких пункта",
            status: "idle",
          },
        })
        .run(),
  },
  {
    id: "divider",
    label: "Разделитель",
    hint: "Линия",
    keywords: "divider hr разделитель",
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

export function SlashMenu({
  top,
  left,
  query,
  onPick,
  onClose,
}: {
  top: number;
  left: number;
  query: string;
  onPick: (run: (editor: Editor) => void) => void;
  onClose: () => void;
}) {
  const filtered = ITEMS.filter((i) =>
    `${i.label} ${i.keywords}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="relay-slash"
      style={{ top, left }}
      role="listbox"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="relay-slash-title">Вставить</div>
      {filtered.length === 0 && <div className="relay-slash-empty">Ничего не найдено</div>}
      {filtered.map((item) => (
        <button
          key={item.id}
          type="button"
          className="relay-slash-item"
          onClick={() => onPick(item.run)}
        >
          <span>{item.label}</span>
          <span className="relay-slash-hint">{item.hint}</span>
        </button>
      ))}
      <button type="button" className="relay-slash-cancel" onClick={onClose}>
        Esc — закрыть
      </button>
    </div>
  );
}
