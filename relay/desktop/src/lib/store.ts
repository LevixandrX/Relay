import {
  emptyDoc,
  welcomeDoc,
  type BoardSnapshot,
  type PageRecord,
  type WorkspaceData,
} from "./types";

const STORAGE_KEY = "relay-desktop-workspace-v1";

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function createPage(title = "Без названия"): PageRecord {
  const t = now();
  return {
    id: id(),
    title,
    icon: null,
    content: emptyDoc(),
    board: null,
    updatedAt: t,
    createdAt: t,
  };
}

function seed(): WorkspaceData {
  const starter = createPage("С чего начать");
  starter.content = welcomeDoc();
  const roadmap = createPage("Дорожная карта");
  roadmap.content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Ближайшие шаги" }],
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
                content: [{ type: "text", text: "Оболочка desktop" }],
              },
            ],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Синхронизация с облаком" }],
              },
            ],
          },
        ],
      },
    ],
  };
  return {
    version: 1,
    pages: [starter, roadmap],
    workspaceBoard: null,
  };
}

export function loadWorkspace(): WorkspaceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const data = seed();
      saveWorkspace(data);
      return data;
    }
    const parsed = JSON.parse(raw) as WorkspaceData;
    if (!parsed?.pages || !Array.isArray(parsed.pages)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

export function saveWorkspace(data: WorkspaceData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function formatRelative(
  iso: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  locale: string,
) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t("relativeJustNow");
  if (m < 60) return t("relativeMinutes", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("relativeHours", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("relativeDays", { count: d });
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU");
}

export type { BoardSnapshot, PageRecord, WorkspaceData };
