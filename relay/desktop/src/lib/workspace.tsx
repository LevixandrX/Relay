import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createPage as createLocalPage,
  loadWorkspace,
  saveWorkspace,
  type BoardSnapshot,
  type PageRecord,
  type WorkspaceData,
} from "./store";
import type { Doc } from "./types";
import { emptyDoc } from "./types";
import { useAuth } from "./auth";
import { api, ApiClientError } from "./api";

export const GUEST_PAGE_LIMIT = 3;
const ACTIVE_WS_KEY = "relay-desktop-active-ws-v1";

type Member = {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
};

type WorkspaceContextValue = {
  mode: "guest" | "cloud";
  pages: PageRecord[];
  workspaceBoard: BoardSnapshot | null;
  activeWorkspaceId: string | null;
  activeRole: string;
  members: Member[];
  offline: boolean;
  guestLimit: number;
  createPage: (title?: string) => Promise<PageRecord>;
  deletePage: (id: string) => Promise<void>;
  updatePage: (
    id: string,
    patch: Partial<Pick<PageRecord, "title" | "content" | "board" | "icon">>,
  ) => Promise<void>;
  setWorkspaceBoard: (board: BoardSnapshot | null) => Promise<void>;
  getPage: (id: string) => PageRecord | undefined;
  loadPage: (id: string) => Promise<PageRecord | null>;
  setActiveWorkspace: (id: string) => void;
  refreshPages: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  inviteMember: (email: string, role: "editor" | "viewer") => Promise<{
    acceptToken: string;
  }>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function persistLocal(next: WorkspaceData) {
  saveWorkspace(next);
  return next;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const mode: "guest" | "cloud" = auth.token && auth.user ? "cloud" : "guest";

  const [local, setLocal] = useState<WorkspaceData>(() => loadWorkspace());
  const [cloudPages, setCloudPages] = useState<PageRecord[]>([]);
  const [workspaceBoard, setWsBoard] = useState<BoardSnapshot | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_WS_KEY);
    } catch {
      return null;
    }
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [offline, setOffline] = useState(false);
  const [pageCache, setPageCache] = useState<Record<string, PageRecord>>({});
  const pageCacheRef = useRef(pageCache);
  pageCacheRef.current = pageCache;

  const activeWs =
    mode === "cloud"
      ? auth.workspaces.find((w) => w.id === activeWorkspaceId) || auth.workspaces[0] || null
      : null;

  useEffect(() => {
    if (mode !== "cloud") return;
    if (!activeWs) {
      if (auth.workspaces[0]) {
        setActiveWorkspaceId(auth.workspaces[0].id);
        localStorage.setItem(ACTIVE_WS_KEY, auth.workspaces[0].id);
      }
      return;
    }
    if (activeWorkspaceId !== activeWs.id) {
      setActiveWorkspaceId(activeWs.id);
      localStorage.setItem(ACTIVE_WS_KEY, activeWs.id);
    }
  }, [mode, auth.workspaces, activeWs, activeWorkspaceId]);

  const refreshPages = useCallback(async () => {
    if (mode !== "cloud" || !activeWs || !auth.token) return;
    try {
      const data = await api<{
        pages: {
          id: string;
          title: string;
          icon: string | null;
          updatedAt: string;
          publicId: string | null;
        }[];
      }>(`/workspaces/${activeWs.id}/pages`, { token: auth.token });
      setOffline(false);
      setCloudPages(
        data.pages.map((p) => ({
          id: p.id,
          title: p.title,
          icon: p.icon,
          content: emptyDoc(),
          board: null,
          updatedAt: p.updatedAt,
          createdAt: p.updatedAt,
        })),
      );
      const board = await api<{ board: BoardSnapshot | null }>(
        `/workspaces/${activeWs.id}/board`,
        { token: auth.token },
      );
      setWsBoard(board.board);
    } catch (err) {
      if (err instanceof ApiClientError && err.status >= 500) setOffline(true);
      else setOffline(true);
    }
  }, [mode, activeWs, auth.token]);

  const refreshMembers = useCallback(async () => {
    if (mode !== "cloud" || !activeWs || !auth.token) {
      setMembers([]);
      return;
    }
    try {
      const data = await api<{ members: Member[] }>(
        `/workspaces/${activeWs.id}/members`,
        { token: auth.token },
      );
      setMembers(data.members);
    } catch {
      setMembers([]);
    }
  }, [mode, activeWs, auth.token]);

  useEffect(() => {
    void refreshPages();
    void refreshMembers();
  }, [refreshPages, refreshMembers]);

  const createPage = useCallback(
    async (title = "Новая страница") => {
      if (mode === "guest") {
        if (local.pages.length >= GUEST_PAGE_LIMIT) {
          throw new Error(
            `Гостевой режим: максимум ${GUEST_PAGE_LIMIT} страницы. Войди, чтобы снять лимит.`,
          );
        }
        const page = createLocalPage(title);
        setLocal((prev) => persistLocal({ ...prev, pages: [page, ...prev.pages] }));
        return page;
      }
      if (!auth.token || !activeWs) throw new Error("Нет облачного пространства");
      const res = await api<{ id: string }>(`/workspaces/${activeWs.id}/pages`, {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ title }),
      });
      const page: PageRecord = {
        id: res.id,
        title,
        icon: null,
        content: emptyDoc(),
        board: null,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setCloudPages((prev) => [page, ...prev]);
      setPageCache((c) => ({ ...c, [page.id]: page }));
      return page;
    },
    [mode, local.pages.length, auth.token, activeWs],
  );

  const deletePage = useCallback(
    async (id: string) => {
      if (mode === "guest") {
        setLocal((prev) =>
          persistLocal({ ...prev, pages: prev.pages.filter((p) => p.id !== id) }),
        );
        return;
      }
      if (!auth.token) return;
      await api(`/pages/${id}`, { method: "DELETE", token: auth.token });
      setCloudPages((prev) => prev.filter((p) => p.id !== id));
      setPageCache((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
    },
    [mode, auth.token],
  );

  const updatePage = useCallback(
    async (
      id: string,
      patch: Partial<Pick<PageRecord, "title" | "content" | "board" | "icon">>,
    ) => {
      if (mode === "guest") {
        setLocal((prev) =>
          persistLocal({
            ...prev,
            pages: prev.pages.map((p) =>
              p.id === id
                ? { ...p, ...patch, updatedAt: new Date().toISOString() }
                : p,
            ),
          }),
        );
        return;
      }
      if (!auth.token) return;
      const current =
        pageCache[id] ||
        cloudPages.find((p) => p.id === id) ||
        ({
          id,
          title: "",
          icon: null,
          content: emptyDoc(),
          board: null,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } satisfies PageRecord);

      const next: PageRecord = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      setPageCache((c) => ({ ...c, [id]: next }));
      setCloudPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, title: next.title, icon: next.icon, updatedAt: next.updatedAt } : p)),
      );

      await api<{ updatedAt: string }>(`/pages/${id}`, {
        method: "PATCH",
        token: auth.token,
        body: JSON.stringify({
          title: patch.title,
          icon: patch.icon,
          content: patch.content,
          board: patch.board,
          baseUpdatedAt: current.updatedAt,
        }),
      }).then((res) => {
        setPageCache((c) => ({
          ...c,
          [id]: { ...next, updatedAt: res.updatedAt },
        }));
      });
    },
    [mode, auth.token, pageCache, cloudPages],
  );

  const setWorkspaceBoard = useCallback(
    async (board: BoardSnapshot | null) => {
      if (mode === "guest") {
        setLocal((prev) => persistLocal({ ...prev, workspaceBoard: board }));
        return;
      }
      if (!auth.token || !activeWs || !board) return;
      setWsBoard(board);
      await api(`/workspaces/${activeWs.id}/board`, {
        method: "PUT",
        token: auth.token,
        body: JSON.stringify({ board }),
      });
    },
    [mode, auth.token, activeWs],
  );

  const getPage = useCallback(
    (id: string) => {
      if (mode === "guest") return local.pages.find((p) => p.id === id);
      return pageCache[id] || cloudPages.find((p) => p.id === id);
    },
    [mode, local.pages, pageCache, cloudPages],
  );

  const loadPage = useCallback(
    async (id: string) => {
      if (mode === "guest") {
        return local.pages.find((p) => p.id === id) ?? null;
      }
      if (!auth.token) return null;
      try {
        const full = await api<{
          id: string;
          title: string;
          icon: string | null;
          content: Doc;
          board: BoardSnapshot | null;
          updatedAt: string;
          createdAt: string;
        }>(`/pages/${id}`, { token: auth.token });
        const page: PageRecord = {
          id: full.id,
          title: full.title,
          icon: full.icon,
          content: full.content,
          board: full.board,
          updatedAt: full.updatedAt,
          createdAt: full.createdAt,
        };
        setPageCache((c) => ({ ...c, [id]: page }));
        setOffline(false);
        return page;
      } catch {
        setOffline(true);
        return pageCacheRef.current[id] ?? null;
      }
    },
    [mode, local.pages, auth.token],
  );

  const setActiveWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    localStorage.setItem(ACTIVE_WS_KEY, id);
    setPageCache({});
  }, []);

  const inviteMember = useCallback(
    async (email: string, role: "editor" | "viewer") => {
      if (!auth.token || !activeWs) throw new Error("Нужен вход");
      return api<{ acceptToken: string }>(`/workspaces/${activeWs.id}/invites`, {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ email, role }),
      });
    },
    [auth.token, activeWs],
  );

  const pages = mode === "guest" ? local.pages : cloudPages;
  const board = mode === "guest" ? local.workspaceBoard : workspaceBoard;

  const value = useMemo(
    () => ({
      mode,
      pages,
      workspaceBoard: board,
      activeWorkspaceId: activeWs?.id ?? null,
      activeRole: activeWs?.role ?? "owner",
      members,
      offline,
      guestLimit: GUEST_PAGE_LIMIT,
      createPage,
      deletePage,
      updatePage,
      setWorkspaceBoard,
      getPage,
      loadPage,
      setActiveWorkspace,
      refreshPages,
      refreshMembers,
      inviteMember,
    }),
    [
      mode,
      pages,
      board,
      activeWs,
      members,
      offline,
      createPage,
      deletePage,
      updatePage,
      setWorkspaceBoard,
      getPage,
      loadPage,
      setActiveWorkspace,
      refreshPages,
      refreshMembers,
      inviteMember,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside provider");
  return ctx;
}

export type { Doc };
