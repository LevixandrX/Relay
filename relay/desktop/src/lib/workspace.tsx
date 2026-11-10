import {PageSaveQueue} from '../../../src/lib/page-save-queue';
import { changedActivityBlocks, type BlockActivityInfo } from "../../../src/lib/block-activity";
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
import { useLocale } from "use-intl";
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
import { api } from "./api";
import {prepareBlockMove,referencedAssets} from '../../../src/domain/blocks/move-content';
import {copyGuestAssets} from '@relay-editor/guest-resources';
import {stageGuestComments} from '@relay-editor/guest-move-comments';
import { notifyActivityChanged } from "@relay-activity-refresh";

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
  workspaceLoading: boolean;
  membersLoading: boolean;
  guestLimit: number;
  createPage: (title?: string) => Promise<PageRecord>;
  deletePage: (id: string) => Promise<void>;
  updatePage: (
    id: string,
    patch: Partial<Pick<PageRecord, "title" | "content" | "board" | "icon">>,
  ) => Promise<void>;
  movePageBlock:(sourceId:string,targetId:string,blockId:string,content:Doc)=>Promise<Doc>;
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

function recordGuestEdits(pageId: string, before: Doc, after: Doc, name: string, timestamp: string) {
  const changes = changedActivityBlocks(before, after);
  if (!changes.length) return;
  const key = `relay-guest-block-activity-v1:${pageId}`;
  const records = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, BlockActivityInfo>;
  for (const block of changes) {
    records[block.id] = {
      createdBy: records[block.id]?.createdBy ?? (block.created ? name : null),
      createdAt: records[block.id]?.createdAt ?? (block.created ? timestamp : null),
      editedBy: name,
      editedAt: timestamp,
    };
  }
  localStorage.setItem(key, JSON.stringify(records));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const guestName = useLocale().startsWith("ru") ? "Гость" : "Guest";
  const mode: "guest" | "cloud" = auth.token && auth.user ? "cloud" : "guest";

  const [local, setLocal] = useState<WorkspaceData>(() => loadWorkspace());
  const localRef = useRef(local);
  const commitLocal = useCallback((next: WorkspaceData) => {
    saveWorkspace(next);
    localRef.current = next;
    setLocal(next);
  }, []);
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
  const [workspaceLoaded, setWorkspaceLoaded] = useState<string | null>(null);
  const [membersLoaded, setMembersLoaded] = useState<string | null>(null);
  const pagesRequest = useRef<AbortController | null>(null);
  const membersRequest = useRef<AbortController | null>(null);
  const [pageCache, setPageCache] = useState<Record<string, PageRecord>>({});
  const saves=useRef(new PageSaveQueue());
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
    pagesRequest.current?.abort();
    if (mode !== "cloud" || !activeWs || !auth.token) return;
    const request = new AbortController();
    pagesRequest.current = request;
    const { signal } = request;
    try {
      const data = await api<{
        pages: {
          id: string;
          title: string;
          icon: string | null;
          updatedAt: string;
          publicId: string | null;
        }[];
      }>(`/workspaces/${activeWs.id}/pages`, { token: auth.token, signal });
      if (signal.aborted) return;
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
        { token: auth.token, signal },
      );
      if (!signal.aborted) setWsBoard(board.board);
    } catch {
      if (!signal.aborted) setOffline(true);
    } finally {
      if (!signal.aborted) setWorkspaceLoaded(activeWs.id);
    }
  }, [mode, activeWs, auth.token]);

  const refreshMembers = useCallback(async () => {
    membersRequest.current?.abort();
    if (mode !== "cloud" || !activeWs || !auth.token) {
      setMembers([]);
      return;
    }
    const request = new AbortController();
    membersRequest.current = request;
    const { signal } = request;
    try {
      const data = await api<{ members: Member[] }>(
        `/workspaces/${activeWs.id}/members`,
        { token: auth.token, signal },
      );
      if (!signal.aborted) setMembers(data.members);
    } catch {
      if (!signal.aborted) setMembers([]);
    } finally {
      if (!signal.aborted) setMembersLoaded(activeWs.id);
    }
  }, [mode, activeWs, auth.token]);

  useEffect(() => {
    void refreshPages();
    void refreshMembers();
    return () => {
      pagesRequest.current?.abort();
      membersRequest.current?.abort();
    };
  }, [refreshPages, refreshMembers]);

  useEffect(() => {
    function onRestored() {
      void refreshPages();
    }
    window.addEventListener("relay:history-restored", onRestored);
    return () => window.removeEventListener("relay:history-restored", onRestored);
  }, [refreshPages]);

  const createPage = useCallback(
    async (title = "Новая страница") => {
      if (mode === "guest") {
        const current = localRef.current;
        if (current.pages.length >= GUEST_PAGE_LIMIT) {
          throw new Error(
            `Гостевой режим: максимум ${GUEST_PAGE_LIMIT} страницы. Войди, чтобы снять лимит.`,
          );
        }
        const page = createLocalPage(title);
        commitLocal({ ...current, pages: [page, ...current.pages] });
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
    [mode, commitLocal, auth.token, activeWs],
  );

  const deletePage = useCallback(
    async (id: string) => {
      if (mode === "guest") {
        const current = localRef.current;
        commitLocal({ ...current, pages: current.pages.filter((p) => p.id !== id) });
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
    [mode, auth.token, commitLocal],
  );

  const updatePage = useCallback(
    async (
      id: string,
      patch: Partial<Pick<PageRecord, "title" | "content" | "board" | "icon">>,
    ) => {
      if (mode === "guest") {
        const current = localRef.current;
        const previous = current.pages.find((page) => page.id === id);
        if (!previous) return;
        const updatedAt = new Date().toISOString();
        const next = { ...previous, ...patch, updatedAt };
        commitLocal({ ...current, pages: current.pages.map((page) => page.id === id ? next : page) });
        if (patch.content) {
          try {
            recordGuestEdits(id, previous.content, patch.content, guestName, updatedAt);
          } catch {
            // Optional activity metadata cannot undo a committed page.
          }
        }
        return;
      }
      if (!auth.token) return;
      const current =
        pageCacheRef.current[id] ||
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
        updatedAt: current.updatedAt,
      };
      setPageCache((c) => ({ ...c, [id]: { ...(c[id] ?? next), ...patch } }));
      setCloudPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, title: patch.title ?? p.title, icon: patch.icon === undefined ? p.icon : patch.icon } : p)),
      );

      const saved = await saves.current.save(id, current.updatedAt, (baseUpdatedAt) => {
        const body = JSON.stringify({ ...patch, baseUpdatedAt });
        return api<{ updatedAt: string }>(`/pages/${id}`, {
          method: "PATCH",
          token: auth.token,
          body,
          keepalive: document.visibilityState === "hidden" && new Blob([body]).size <= 60_000,
        });
      });
      setPageCache((c) => c[id] ? { ...c, [id]: { ...c[id], updatedAt: saved.updatedAt } } : c);
      setCloudPages((prev) => prev.map((page) => page.id === id ? { ...page, updatedAt: saved.updatedAt } : page));
      notifyActivityChanged({ workspaceId: activeWs?.id ?? null, pageId: id });
    },
    [mode, auth.token, cloudPages, activeWs?.id, commitLocal, guestName],
  );

  const setWorkspaceBoard = useCallback(
    async (board: BoardSnapshot | null) => {
      if (mode === "guest") {
        commitLocal({ ...localRef.current, workspaceBoard: board });
        return;
      }
      if (!auth.token || !activeWs || !board) return;
      setWsBoard(board);
      const body = JSON.stringify({ board });
      await api(`/workspaces/${activeWs.id}/board`, {
        method: "PUT",
        token: auth.token,
        body,
        keepalive: document.visibilityState === "hidden" && new Blob([body]).size <= 60_000,
      });
      notifyActivityChanged({ workspaceId: activeWs.id, pageId: null });
    },
    [mode, auth.token, activeWs, commitLocal],
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
        return localRef.current.pages.find((p) => p.id === id) ?? null;
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
        saves.current.seed(id,page.updatedAt);
        setPageCache((c) => ({ ...c, [id]: page }));
        setOffline(false);
        return page;
      } catch {
        setOffline(true);
        return pageCacheRef.current[id] ?? null;
      }
    },
    [mode, auth.token],
  );

  const setActiveWorkspace = useCallback((id: string) => {
    if (id === activeWs?.id) return;
    setActiveWorkspaceId(id);
    localStorage.setItem(ACTIVE_WS_KEY, id);
    setPageCache({});
    setCloudPages([]);
    setWsBoard(null);
    setMembers([]);
    setWorkspaceLoaded(null);
    setMembersLoaded(null);
  }, [activeWs?.id]);

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
  const workspaceLoading = Boolean(activeWs && workspaceLoaded !== activeWs.id);
  const membersLoading = Boolean(activeWs && membersLoaded !== activeWs.id);

  const movePageBlock=useCallback(async(sourceId:string,targetId:string,blockId:string,content:Doc)=>{
    if(sourceId===targetId)throw new Error('Same page');
    if(mode==='guest'){
      const initial=localRef.current.pages.find(page=>page.id===targetId);if(!initial)throw new Error('Page not found');
      const prepared=prepareBlockMove(content,initial.content,blockId),assets=await copyGuestAssets(sourceId,targetId,referencedAssets(prepared.moving));
      const current=localRef.current,target=current.pages.find(page=>page.id===targetId);if(!target||target.updatedAt!==initial.updatedAt)throw new Error('Destination changed');
      const result=prepareBlockMove(content,target.content,blockId,assets),staged=stageGuestComments(sourceId,targetId,result.blockIds),updatedAt=new Date().toISOString();
      try{commitLocal({...current,pages:current.pages.map(page=>page.id===sourceId?{...page,content:result.source,updatedAt}:page.id===targetId?{...page,content:result.destination,updatedAt}:page)});}catch(error){staged.rollback();throw error;}staged.commit();return result.source;
    }
    const result=await api<{sourceContent:Doc;updatedAt:string}>(`/pages/${sourceId}/tools`,{method:'POST',token:auth.token,body:JSON.stringify({action:'moveBlock',targetPageId:targetId,blockId,content})});
    await Promise.all([loadPage(sourceId),loadPage(targetId)]);notifyActivityChanged({workspaceId:activeWs?.id??null,pageId:sourceId});return result.sourceContent;
  },[mode,auth.token,loadPage,activeWs?.id,commitLocal]);
  const value = useMemo(
    () => ({
      mode,
      pages,
      workspaceBoard: board,
      activeWorkspaceId: activeWs?.id ?? null,
      activeRole: activeWs?.role ?? "owner",
      members,
      offline,
      workspaceLoading,
      membersLoading,
      guestLimit: GUEST_PAGE_LIMIT,
      createPage,
      deletePage,
      updatePage,
      movePageBlock,
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
      workspaceLoading,
      membersLoading,
      createPage,
      deletePage,
      updatePage,
      movePageBlock,
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
