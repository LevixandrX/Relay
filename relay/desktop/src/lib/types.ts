export type JSONContent = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export type Doc = {
  type: "doc";
  content?: JSONContent[];
};

/** Opaque tldraw snapshot */
export type BoardSnapshot = Record<string, unknown>;

export type PageRecord = {
  id: string;
  title: string;
  icon: string | null;
  content: Doc;
  board: BoardSnapshot | null;
  updatedAt: string;
  createdAt: string;
};

export type WorkspaceData = {
  version: 1;
  pages: PageRecord[];
  workspaceBoard: BoardSnapshot | null;
};

export function emptyDoc(): Doc {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function welcomeDoc(): Doc {
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
            text: "Пиши здесь или нажми «/» для блоков. Переключись на «Холст», чтобы набросать схему.",
          },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Создавай страницы слева" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Всё сохраняется локально на этом ПК" }],
              },
            ],
          },
        ],
      },
    ],
  };
}
