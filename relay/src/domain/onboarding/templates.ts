import type { Doc } from "@/domain/blocks/schema";

export type Intent = "write" | "plan" | "team";

export function gettingStartedDoc(): Doc {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Добро пожаловать в Relay" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Это твоя песочница. Слева — бесконечный холст для схем и рисунков. Здесь — текст блоками.",
          },
        ],
      },
      {
        type: "callout",
        attrs: { emoji: "⌨️" },
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Нажми " },
              { type: "text", marks: [{ type: "code" }], text: "/" },
              { type: "text", text: " — меню блоков. " },
              { type: "text", text: "Поиск страниц — из меню слева. Переключатель «Холст / Текст» сверху." },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Чеклист" }],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Аккаунт создан" }],
              },
            ],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Поправь эту строку" }],
              },
            ],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Запусти Live Prompt ниже" }],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Live Prompt" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Блок читает структуру страницы и вставляет результат. Нажми «Запустить»:",
          },
        ],
      },
      {
        type: "promptBlock",
        attrs: {
          prompt: "Суммируй эту страницу в 3 коротких пункта",
          status: "idle",
        },
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Поделиться" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Кнопка «Поделиться» сверху — публичная ссылка или приглашение в пространство.",
          },
        ],
      },
    ],
  };
}

export function starterPagesForIntent(intent: Intent): { title: string; icon: string; doc: Doc }[] {
  const shared = {
    title: "С чего начать",
    icon: "✨",
    doc: gettingStartedDoc(),
  };

  if (intent === "write") {
    return [
      shared,
      {
        title: "Черновики",
        icon: "✍️",
        doc: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Черновики" }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Пиши свободно. Для переписывания — / и Live Prompt. Для схем — режим «Холст».",
                },
              ],
            },
          ],
        },
      },
    ];
  }

  if (intent === "plan") {
    return [
      shared,
      {
        title: "Дорожная карта",
        icon: "🗺️",
        doc: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Дорожная карта" }],
            },
            {
              type: "taskList",
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Определить MVP" }],
                    },
                  ],
                },
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Опубликовать первую ссылку" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "promptBlock",
              attrs: {
                prompt: "Преврати эту дорожную карту в план на неделю",
                status: "idle",
              },
            },
          ],
        },
      },
    ];
  }

  return [
    shared,
    {
      title: "Командный хаб",
      icon: "🏠",
      doc: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Командный хаб" }],
          },
          {
            type: "callout",
            attrs: { emoji: "👋" },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Сюда — решения, ссылки и владельцы." }],
              },
            ],
          },
        ],
      },
    },
  ];
}
