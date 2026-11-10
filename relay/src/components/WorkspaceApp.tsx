"use client";

import { PageActions } from "./PageActions";
import { SaveIndicator, useSaveFeedback } from "./SaveIndicator";
import { LoadingIndicator } from "./LoadingIndicator";
import Link from "next/link";
import {PageSaveQueue} from "../lib/page-save-queue";
import { useSaveBatch } from "../lib/use-save-batch";
import { useViewMotion } from "./use-view-motion";
import { useSidebarPeek } from "./use-sidebar-peek";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BlockEditor } from "@/editor/BlockEditor";
import { InfiniteBoard, type BoardSnapshot } from "@/components/InfiniteBoard";
import type { Doc } from "@/domain/blocks/schema";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { WebWorkspaceSwitcher } from "@/components/WebWorkspaceSwitcher";
import { WorkspaceShareModal } from "@/components/WorkspaceShareModal";
import { DialogProvider, useDialog } from "@/components/DialogHost";
import { HelpButton, HelpPanel } from "@/components/BoardHelp";
import { ActivityDisclosure } from "@/components/ActivityDisclosure";
import {
  clearActivityFocus,
  focusFromRevision,
  readActivityFocus,
  stageActivityFocus,
  subscribeActivityFocus,
  type ActivityFocus,
} from "@/lib/board/activity-focus";
import { SearchPalette } from "@/components/SearchPalette";
import { useTranslations } from "next-intl";
import { workspaceDisplayName } from "@/domain/workspaces/naming";
import {
  readPulseSeen,
  subscribePulseSeen,
  writePulseSeen,
} from "@/lib/board/pulse-seen";
import { shortcutHint, useModLabel } from "@/lib/board/mod-key";
import { UserAvatar } from "@/components/UserAvatar";
import { AccountSettings } from "@/components/AccountSettings";
import { VersionHistory, type HistoryClient, type RevisionSummary } from "@/components/VersionHistory";
import { ContentModeSwitch } from "@/components/ContentModeSwitch";
import { notifyActivityChanged } from "@/lib/activity-refresh";
import { CompactRailScroll, OverlayScroll } from "@/lib/board/CompactRailScroll";

function historyClient(workspaceId: string, pageId: string | null): HistoryClient {
  if (!pageId) {
    return {
      list: () => fetch(`/api/v1/workspaces/${workspaceId}/board/revisions`).then((r) => r.json()),
      get: (id) => fetch(`/api/v1/workspaces/${workspaceId}/board/revisions/${id}`).then((r) => r.json()),
      restore: async (id) => {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/board/revisions/${id}/restore`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("restore");
      },
    };
  }
  return {
    list: () => fetch(`/api/v1/pages/${pageId}/revisions`).then((r) => r.json()),
    get: (id) => fetch(`/api/v1/pages/${pageId}/revisions/${id}`).then((r) => r.json()),
    restore: async (id) => {
      const res = await fetch(`/api/v1/pages/${pageId}/revisions/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("restore");
    },
  };
}

async function loadHistoryCurrent(workspaceId: string, pageId: string | null) {
  if (!pageId) {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/board`);
    const data = await res.json().catch(() => ({}));
    return { title: "", content: null, board: (data as { board?: unknown }).board ?? null };
  }
  const res = await fetch(`/api/v1/pages/${pageId}`);
  const data = await res.json().catch(() => ({}));
  const page = data as { title?: string; content?: unknown; board?: unknown };
  return { title: page.title ?? "", content: page.content ?? null, board: page.board ?? null };
}

type PageMeta = {
  id: string;
  title: string;
  icon: string | null;
  parentPageId: string | null;
  position: number;
  publicId: string | null;
};

type Checklist = {
  editedPage: boolean;
  usedSlashOrPrompt: boolean;
  openedShare: boolean;
  dismissed: boolean;
};

type ViewMode = "board" | "text";
type PageDraft = { title?: string; readContent?: () => Doc; readBoard?: () => BoardSnapshot };

type Props = {
  workspaceId: string;
  workspaceName: string;
  /** null = открыт холст пространства */
  pageId: string | null;
  role: string;
  initialPages: PageMeta[];
  initialPage: {
    id: string;
    title: string;
    icon: string | null;
    content: Doc;
    board: BoardSnapshot | null;
    updatedAt: string;
    publicId: string | null;
  } | null;
  workspaceBoard: BoardSnapshot | null;
  checklist: Checklist | null;
  defaultMode?: ViewMode;
  ownerName?: string | null;
  viewerId: string;
};

export function WorkspaceApp(props: Props) {
  return (
    <DialogProvider>
      <WorkspaceAppInner {...props} />
    </DialogProvider>
  );
}

function WorkspaceAppInner({
  workspaceId,
  workspaceName,
  pageId,
  role,
  initialPages,
  initialPage,
  workspaceBoard,
  checklist: initialChecklist,
  defaultMode = "board",
  ownerName,
  viewerId,
}: Props) {
  const t = useTranslations("app");
  const tc = useTranslations("common");
  const tb = useTranslations("board");
  const td = useTranslations("desktop");
  const dialog = useDialog();
  const mod = useModLabel();
  const searchHint = shortcutHint(mod, "K");
  const router = useRouter();
  const pathname = usePathname();
  const canWrite = role === "owner" || role === "editor";
  const isWorkspaceBoard = !pageId;

  const [pages, setPages] = useState(initialPages);
  const [title, setTitle] = useState(initialPage?.title ?? "");
  const [content, setContent] = useState<Doc>(
    initialPage?.content ?? { type: "doc", content: [{ type: "paragraph" }] },
  );
  const [contentPageId, setContentPageId] = useState(pageId);
  const [pageBoard, setPageBoard] = useState<BoardSnapshot | null>(
    initialPage?.board ?? null,
  );
  const [publicId, setPublicId] = useState(initialPage?.publicId ?? null);
  const [saveState, setSaveState, saveRevision] = useSaveFeedback();
  const [checklist, setChecklist] = useState(initialChecklist);
  const [pulseSeen, setPulseSeen] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [compassQ, setCompassQ] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { pageId: string; title: string; snippet: string }[]
  >([]);
  const [mode, setMode] = useState<ViewMode>(isWorkspaceBoard ? "board" : defaultMode);
  const modeMotion = useViewMotion<HTMLDivElement>(
    isWorkspaceBoard || contentPageId === pageId ? `${pathname}:${mode}` : null,
    mode === "text" ? "forward" : "back",
  );
  const [me, setMe] = useState<{
    name: string;
    email: string;
    avatarUrl?: string | null;
    providers?: string[];
    hasPassword?: boolean;
  } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ pageId: string | null; entryId?: string } | null>(
    null,
  );
  const [activityFocus, setActivityFocus] = useState<ActivityFocus | null>(null);
  const activityFocusTimer = useRef<number | null>(null);
  const [chrome, setChrome] = useState<"expanded" | "rail" | "focus">("expanded");
  const rail = chrome === "rail";
  const { sidebarRef, beforeNavigate } = useSidebarPeek(chrome === "focus");
  const [peekTop, setPeekTop] = useState(false);
  const [focusHint, setFocusHint] = useState(false);
  const [focusHintHide, setFocusHintHide] = useState(false);
  const peekHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageTitleInput = useRef<HTMLInputElement>(null);
  const prevModeRef = useRef<ViewMode>(isWorkspaceBoard ? "board" : defaultMode);
  const saves=useRef(new PageSaveQueue());
  const batch = useSaveBatch<PageDraft>(`${workspaceId}:${pageId ?? ""}`);
  const currentBatch = useRef(batch);
  currentBatch.current = batch;
  const draft = useRef<PageDraft>({});
  const railListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("relay.web.chrome");
      if (saved === "expanded" || saved === "rail" || saved === "focus") setChrome(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // normal → compact → zen, the same rotation the desktop shell uses
  const nextChrome = chrome === "expanded" ? "rail" : chrome === "rail" ? "focus" : "expanded";
  const nextChromeLabel =
    nextChrome === "expanded"
      ? tb("chromeNormal")
      : nextChrome === "rail"
        ? tb("chromeCompact")
        : tb("chromeZen");

  function setChromePersist(next: "expanded" | "rail" | "focus") {
    setChrome(next);
    setPeekTop(false);
    if (next !== "focus") {
      setFocusHint(false);
      if (focusHintTimer.current) {
        clearTimeout(focusHintTimer.current);
        focusHintTimer.current = null;
      }
    }
    if (peekHideTimer.current) {
      clearTimeout(peekHideTimer.current);
      peekHideTimer.current = null;
    }
    try {
      localStorage.setItem("relay.web.chrome", next);
    } catch {
      /* ignore */
    }
  }

  function toggleFocus() {
    if (chrome === "focus") {
      setChromePersist("expanded");
      setFocusHint(false);
      if (focusHintTimer.current) clearTimeout(focusHintTimer.current);
      return;
    }
    setChromePersist("focus");
    try {
      if (localStorage.getItem("relay_focus_hint") === "1") return;
    } catch {
      /* ignore */
    }
    setFocusHint(true);
    setFocusHintHide(false);
    if (focusHintTimer.current) clearTimeout(focusHintTimer.current);
    focusHintTimer.current = setTimeout(() => {
      setFocusHintHide(true);
      focusHintTimer.current = setTimeout(() => {
        setFocusHint(false);
        try {
          localStorage.setItem("relay_focus_hint", "1");
        } catch {
          /* ignore */
        }
      }, 450);
    }, 4200);
  }

  function showTopPeek() {
    if (peekHideTimer.current) {
      clearTimeout(peekHideTimer.current);
      peekHideTimer.current = null;
    }
    setPeekTop(true);
  }

  function scheduleHideTopPeek() {
    if (peekHideTimer.current) clearTimeout(peekHideTimer.current);
    peekHideTimer.current = setTimeout(() => {
      setPeekTop(false);
      peekHideTimer.current = null;
    }, 220);
  }

  useEffect(() => {
    if (chrome !== "focus") return;
    const hideTopPeek = () => {
      if (peekHideTimer.current) clearTimeout(peekHideTimer.current);
      peekHideTimer.current = null;
      setPeekTop(false);
    };
    window.addEventListener("blur", hideTopPeek);
    const bump = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 280);
    return () => {
      window.removeEventListener("blur", hideTopPeek);
      window.clearTimeout(bump);
      if (peekHideTimer.current) clearTimeout(peekHideTimer.current);
      peekHideTimer.current = null;
    };
  }, [chrome]);


  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          user?: {
            name?: string;
            email?: string;
            avatarUrl?: string | null;
            providers?: string[];
            hasPassword?: boolean;
          };
        };
        if (!cancelled && data.user) {
          setMe({
            name: data.user.name ?? "",
            email: data.user.email ?? "",
            avatarUrl: data.user.avatarUrl,
            providers: data.user.providers,
            hasPassword: data.user.hasPassword,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isWorkspaceBoard) return;
    if (prevModeRef.current !== mode) {
      try {
        localStorage.setItem("relay_coach_page", "1");
      } catch {
        /* ignore */
      }
    }
    prevModeRef.current = mode;
  }, [mode, isWorkspaceBoard]);

  useEffect(() => {
    draft.current = {};
    setSaveState("idle");
    setMode(isWorkspaceBoard ? "board" : defaultMode);
    setTitle(initialPage?.title ?? "");
    setContent(initialPage?.content ?? { type: "doc", content: [{ type: "paragraph" }] });
    setContentPageId(pageId);
    setPageBoard(initialPage?.board ?? null);
    setPublicId(initialPage?.publicId ?? null);
    if (pageId && initialPage) saves.current.seed(pageId, initialPage.updatedAt);
  }, [pageId, initialPage, isWorkspaceBoard, defaultMode]);

  useEffect(() => {
    const focus = readActivityFocus(isWorkspaceBoard ? null : pageId ?? null);
    if (!focus) return;
    setActivityFocus(focus);
    setMode(focus.mode);
    clearActivityFocus();
    if (activityFocusTimer.current !== null) window.clearTimeout(activityFocusTimer.current);
    activityFocusTimer.current =
      focus.mode === "board" ? window.setTimeout(() => setActivityFocus(null), 5000) : null;
    return () => {
      if (activityFocusTimer.current !== null) window.clearTimeout(activityFocusTimer.current);
    };
  }, [isWorkspaceBoard, pageId]);

  useEffect(
    () =>
      subscribeActivityFocus((focus) => {
        const currentPageId = isWorkspaceBoard ? null : pageId ?? null;
        if (focus.pageId !== currentPageId) return;
        setActivityFocus(focus);
        setMode(focus.mode);
        clearActivityFocus();
        if (activityFocusTimer.current !== null) window.clearTimeout(activityFocusTimer.current);
        activityFocusTimer.current =
          focus.mode === "board" ? window.setTimeout(() => setActivityFocus(null), 5000) : null;
      }),
    [isWorkspaceBoard, pageId],
  );

  const markChecklist = useCallback(
    async (key: "editedPage" | "usedSlashOrPrompt" | "openedShare" | "dismissed") => {
      if (!checklist || checklist[key]) return;
      setChecklist({ ...checklist, [key]: true });
      const apiKey =
        key === "editedPage"
          ? "edited_page"
          : key === "usedSlashOrPrompt"
            ? "used_slash_or_prompt"
            : key === "openedShare"
              ? "opened_share"
              : "dismissed";
      await fetch("/api/v1/me/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey }),
      });
    },
    [checklist],
  );

  const refreshPages = useCallback(async () => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/pages`);
    if (!res.ok) return;
    const data = await res.json();
    setPages(data.pages);
  }, [workspaceId]);

  const bumpActivity = useCallback(() => {
    notifyActivityChanged({ workspaceId, pageId: pageId ?? null });
  }, [workspaceId, pageId]);

  useEffect(() => {
    void fetch(`/api/v1/workspaces/${workspaceId}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: pageId ?? null }),
    });
  }, [workspaceId, pageId]);

  useEffect(() => {
    const sync = () => setPulseSeen(readPulseSeen(workspaceId));
    sync();
    return subscribePulseSeen(sync);
  }, [workspaceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.code === "KeyK" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setCompassQ("");
        setCompassOpen(true);
      }
      if (e.key === "Escape") {
        if (compassOpen || shareOpen) {
          e.preventDefault();
          e.stopPropagation();
          setCompassOpen(false);
          setShareOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compassOpen, shareOpen]);

  useEffect(() => {
    const onPage = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) router.push(`/w/${workspaceId}/p/${id}`);
    };
    const onBoard = () => router.push(`/w/${workspaceId}/board`);
    window.addEventListener("relay:open-page", onPage);
    window.addEventListener("relay:open-board", onBoard);
    return () => {
      window.removeEventListener("relay:open-page", onPage);
      window.removeEventListener("relay:open-board", onBoard);
    };
  }, [router, workspaceId]);

  useEffect(() => {
    if (!compassOpen) return;
    if (compassQ.trim().length < 1) {
      setSearchLoading(false);
      setSearchResults(
        pages.slice(0, 8).map((p) => ({ pageId: p.id, title: p.title, snippet: "" })),
      );
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/workspaces/${workspaceId}/search?q=${encodeURIComponent(compassQ)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (!controller.signal.aborted) setSearchResults(data.results);
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [compassOpen, compassQ, workspaceId, pages]);

  async function sendSave(url: string, method: "PUT" | "PATCH", payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: document.visibilityState === "hidden" && new Blob([body]).size <= 60_000,
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message ?? "Save failed"), { status: response.status });
    return data as { updatedAt: string };
  }

  function stageEdit(patch: PageDraft, announce = true) {
    if (!canWrite || (pageId && !initialPage)) return;
    Object.assign(draft.current, patch);
    batch.stage(patch, async ({ title, readContent, readBoard }, showStatus) => {
      if (showStatus && currentBatch.current === batch) setSaveState("saving");
      try {
        if (pageId && initialPage) {
          await saves.current.save(pageId, initialPage.updatedAt, (baseUpdatedAt) =>
            sendSave(`/api/v1/pages/${pageId}`, "PATCH", {
              title, content: readContent?.(), board: readBoard?.(), baseUpdatedAt,
            }),
          );
        } else {
          await sendSave(`/api/v1/workspaces/${workspaceId}/board`, "PUT", { board: readBoard?.() });
        }
        if (currentBatch.current === batch) {
          if (title !== undefined) setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, title } : p));
          if (showStatus) setSaveState("saved");
        }
        if (showStatus) {
          if (currentBatch.current === batch) void markChecklist("editedPage");
          bumpActivity();
        }
      } catch (error) {
        if (currentBatch.current === batch) setSaveState("error");
        throw error;
      }
    }, announce);
  }

  function acceptSavedContent(doc: Doc, updatedAt: string) {
    if (!pageId || currentBatch.current !== batch) return;
    saves.current.seed(pageId, updatedAt);
    delete draft.current.readContent;
    setContent(doc);
    setSaveState("saved");
  }

  async function createPage() {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t("newPageTitle") }),
    });
    const data = await res.json();
    if (!res.ok) return;
    await refreshPages();
    router.push(`/w/${workspaceId}/p/${data.id}?mode=text`);
  }

  async function moveBlock(targetPageId: string, blockId: string, doc: Doc) {
    await batch.flush();
    const response = await fetch(`/api/v1/pages/${pageId}/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "moveBlock", targetPageId, blockId, content: doc }),
    });
    if (!response.ok) throw Object.assign(new Error("move failed"), { status: response.status });
    const result = await response.json() as { sourceContent: Doc; updatedAt: string };
    acceptSavedContent(result.sourceContent, result.updatedAt);
    bumpActivity();
    return result.sourceContent;
  }

  async function runPrompt(prompt: string) {
    if (!pageId) return;
    try { await batch.flush(); } catch { return; }
    void markChecklist("usedSlashOrPrompt");
    const res = await fetch(`/api/v1/pages/${pageId}/run-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) return;
    acceptSavedContent(data.content, data.updatedAt);
    bumpActivity();
  }

  async function togglePublish() {
    if (!pageId) return;
    if (publicId) {
      await fetch(`/api/v1/pages/${pageId}/publish`, { method: "DELETE" });
      setPublicId(null);
    } else {
      const res = await fetch(`/api/v1/pages/${pageId}/publish`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setPublicId(data.publicId);
    }
    void markChecklist("openedShare");
    bumpActivity();
  }

  async function deletePage(targetId: string, pageTitle: string) {
    if (!canWrite) return;
    const ok = await dialog.confirm({
      title: t("deletePageConfirm", { title: pageTitle || tc("untitled") }),
      confirmLabel: tc("delete"),
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/v1/pages/${targetId}`, { method: "DELETE" });
    if (!res.ok) return;
    if (pageId === targetId) batch.discardPending();
    await refreshPages();
    if (pageId === targetId) {
      router.push(`/w/${workspaceId}/board`);
    }
  }

  const publicUrl = useMemo(() => {
    if (!publicId) return null;
    const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "");
    return `${base}/p/${publicId}`;
  }, [publicId]);

  const pageUrl =
    typeof window !== "undefined" && pageId
      ? `${window.location.origin}/w/${workspaceId}/p/${pageId}`
      : pageId
        ? `/w/${workspaceId}/p/${pageId}`
        : null;


  function labelAction(action: string) {
    const map: Record<string, string> = {
      "page.create": t("actionPageCreate"),
      "page.update": t("actionPageUpdate"),
      "page.publish": t("actionPagePublish"),
      "page.prompt": t("actionPagePrompt"),
      "page.restore": t("actionPageRestore"),
      "member.invite": t("actionMemberInvite"),
      "workspace.create": t("actionWorkspaceCreate"),
      "board.update": t("actionBoardUpdate"),
      "board.restore": t("actionBoardRestore"),
    };
    return map[action] ?? action;
  }

  function markPulseSeen(id: string) {
    writePulseSeen(workspaceId, id);
    setPulseSeen(id);
  }

  const saveLabel =
    saveState === "saving"
      ? tc("saving")
      : saveState === "error"
        ? tc("saveError")
        : tc("save");

  const shownWorkspaceName = workspaceDisplayName(workspaceName, ownerName, (name) =>
    t("personalWorkspace", { name }),
  );

  async function logout() {
    const ok = await dialog.confirm({ title: tc("logoutConfirm"), confirmLabel: tc("logout") });
    if (!ok) return;
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div
      className="relay-shell"
      data-chrome={chrome}
      data-peek-top={peekTop || undefined}
    >
      {chrome === "focus" && (
        <div className="relay-edge-peek-top" onMouseEnter={showTopPeek} onMouseLeave={scheduleHideTopPeek} aria-hidden />
      )}

      {focusHint && chrome === "focus" && (
        <div className="relay-focus-toast" data-hide={focusHintHide || undefined} role="status">
          {t("focusHint")}
        </div>
      )}

      <main className="relay-main">
        <div
          className="relay-topbar"
          onMouseEnter={() => {
            if (chrome === "focus") showTopPeek();
          }}
          onMouseLeave={() => {
            if (chrome === "focus") scheduleHideTopPeek();
          }}
        >
          <div className="relay-topbar-left">
            {chrome === "focus" && (
              <button
                type="button"
                className="relay-icon-btn relay-icon-btn-surface"
                title={t("exitFocus")}
                aria-label={t("exitFocus")}
                data-active="true"
                onClick={toggleFocus}
              >
                <FocusIcon />
              </button>
            )}
            {!isWorkspaceBoard && (
              <ContentModeSwitch
                value={mode}
                onChange={setMode}
                boardLabel={t("board")}
                textLabel={t("text")}
              />
            )}
          </div>

          <div className="relay-topbar-center">
            {isWorkspaceBoard ? (
              <div className="relay-topbar-title-static">
                {t("boardContext")} <span>{shownWorkspaceName}</span>
              </div>
            ) : (
              <input
                ref={pageTitleInput}
                className="relay-topbar-title"
                value={title}
                placeholder={t("pageTitlePlaceholder")}
                disabled={!canWrite}
                aria-label={t("pageTitlePlaceholder")}
                onChange={(event) => {
                  const next = event.target.value;
                  stageEdit({ title: next });
                  setTitle(next);
                }}
              />
            )}
            {canWrite && <SaveIndicator state={saveState} revision={saveRevision} label={saveLabel} />}
          </div>

          <div className="relay-topbar-actions">
            <button
              type="button"
              className="relay-btn relay-btn-compact"
              onClick={() => {
                setShareOpen(true);
                void markChecklist("openedShare");
              }}
            >
              {t("share")}
            </button>
            {!isWorkspaceBoard && pageId && (
              <PageActions
                key={pageId}
                pageUrl={pageUrl ? pageUrl + "?mode=" + mode : null}
                publicUrl={publicUrl}
                onRename={canWrite ? () => { pageTitleInput.current?.focus(); pageTitleInput.current?.select(); } : undefined}
                onHistory={() => {
                  void batch.flush().then(() => setHistoryTarget({ pageId })).catch(() => undefined);
                }}
                onDelete={canWrite ? () => void deletePage(pageId, title) : undefined}
              />
            )}
            <div className="relay-topbar-app">
              <ActivityDisclosure
                variant="chrome"
                items={[]}
                unread={false}
                labelAction={labelAction}
                scopeTitle={isWorkspaceBoard ? t("infiniteBoard") : title}
                scopePageId={pageId}
                viewerId={viewerId}
                seenId={pulseSeen}
                onSeen={markPulseSeen}
                refreshKey={pageId ?? "board"}
                listUpdates={async () => {
                  const path = pageId
                    ? `/api/v1/pages/${pageId}/revisions`
                    : `/api/v1/workspaces/${workspaceId}/activity`;
                  const res = await fetch(path, { cache: "no-store" });
                  const data = await res.json().catch(() => ({ revisions: [] }));
                  return (data.revisions ?? []) as RevisionSummary[];
                }}
                listAnalytics={async (range) => {
                  const q = new URLSearchParams({ range });
                  if (pageId) q.set("pageId", pageId);
                  const res = await fetch(`/api/v1/workspaces/${workspaceId}/analytics?${q}`);
                  if (!res.ok) throw new Error("analytics");
                  return res.json();
                }}
                onViewVersion={(row) => {
                  setHistoryTarget({
                    pageId: row.scope === "board" ? null : (row.pageId ?? pageId),
                    entryId: row.id,
                  });
                }}
                onOpenUpdate={(row, block) => {
                  const focus = focusFromRevision(row, block);
                  if (row.scope !== "board" && !focus.pageId) focus.pageId = pageId ?? null;
                  stageActivityFocus(focus);
                  if (focus.pageId) {
                    router.push(`/w/${workspaceId}/p/${focus.pageId}`);
                  } else {
                    router.push(`/w/${workspaceId}/board`);
                  }
                }}
              />
              <HelpButton />
              <LanguageToggle variant="toolbar" />
              <ThemeToggle variant="toolbar" />
            </div>
          </div>
        </div>

        {(isWorkspaceBoard || mode === "board") && (
          <div ref={modeMotion} className="relay-board-wrap">
            <InfiniteBoard
              key={isWorkspaceBoard ? `ws-${workspaceId}` : `pg-${pageId}-board`}
              editable={canWrite}
              initialSnapshot={isWorkspaceBoard ? workspaceBoard : pageBoard}
              getDraft={() => draft.current.readBoard?.()}
              syncRoomId={isWorkspaceBoard ? `ws-${workspaceId}` : `pg-${pageId}`}
              viewerId={viewerId}
              onChange={(readBoard) => stageEdit({ readBoard })}
              focusShapeIds={activityFocus?.shapeIds}
            />
          </div>
        )}

        {!isWorkspaceBoard && mode === "text" && initialPage && (
          <OverlayScroll ref={modeMotion} arrows className="relay-page-scroll" contentClassName="relay-page">
            {contentPageId === pageId ? <BlockEditor
              key={pageId}
              content={content}
              getDraft={() => draft.current.readContent?.()}
              resources={pageId?{
                pageId,
                moveBlock,
                request:async <T,>(suffix:string,init?:RequestInit):Promise<T>=>{const response=await fetch(`/api/v1/pages/${pageId}/tools${suffix}`,init);if(!response.ok)throw new Error('resources');return response.json() as Promise<T>;},
                openPage:(id)=>router.push(`/w/${workspaceId}/p/${id}?mode=text`),
                createPage:async(title)=>{const response=await fetch(`/api/v1/workspaces/${workspaceId}/pages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,parentPageId:pageId})});if(!response.ok)throw new Error('create page');const result=await response.json() as {id:string};await refreshPages();return{id:result.id,title};},
              }:undefined}
              comments={pageId ? {
                pageId, identity: viewerId,
                request: async <T,>(suffix: string, init?: RequestInit): Promise<T> => {
                  const res = await fetch(`/api/v1/pages/${pageId}/comments${suffix}`, init);
                  if (!res.ok) throw new Error("comments");
                  return res.json() as Promise<T>;
                },
                blockLink: (blockId, threadId) => `${window.location.origin}/w/${workspaceId}/p/${pageId}?mode=text#${new URLSearchParams({ block: blockId, ...(threadId ? { comment: threadId } : {}) })}`,
                openPage: (id) => router.push(`/w/${workspaceId}/p/${id}?mode=text`),
              } : undefined}
              editable={canWrite}
              onChange={(readContent, { initializing }) => stageEdit({ readContent }, !initializing)}
              onSlashUsed={() => void markChecklist("usedSlashOrPrompt")}
              onRunPrompt={runPrompt}
              focusPhrases={activityFocus?.phrases}
              focusBlockType={activityFocus?.blockType}
              onActivityFocusDismiss={() => setActivityFocus(null)}
            /> : <LoadingIndicator centered />}
          </OverlayScroll>
        )}
      </main>

      <aside
        ref={sidebarRef}
        className="sidebar relay-sidebar relay-peek-sidebar"
        data-peek-enabled={chrome === "focus" || undefined}
        data-collapsed={rail ? "true" : "false"}
      >
        {!rail && (
          <div className="sidebar-logo">
            <BrandLockup size={22} wordmark />
          </div>
        )}

        <div className="sidebar-brand">
          <WebWorkspaceSwitcher
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            ownerName={ownerName}
            collapsed={rail}
            onInvite={() => {
              setShareOpen(true);
              void markChecklist("openedShare");
            }}
          />
        </div>

        <div className="sidebar-quick">
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setCompassQ("");
              setCompassOpen(true);
            }}
            data-tooltip={`${tc("search")} · ${searchHint}`}
            aria-label={tc("search")}
          >
            <span className="nav-ico">
              <SearchIcon />
            </span>
            <span className="nav-title">{tc("search")}</span>
            {!rail && <span className="nav-hint">{searchHint}</span>}
          </button>
        </div>

        <nav id="relay-sidebar-nav" className="sidebar-nav" aria-label={tc("menu")}>
          <Link
            href={`/w/${workspaceId}/board`}
            onNavigate={beforeNavigate}
            className="nav-item"
            data-active={isWorkspaceBoard}
            data-tooltip={td("navBoardHint")}
            aria-current={isWorkspaceBoard ? "page" : undefined}
            aria-label={t("board")}
          >
            <span className="nav-ico">
              <BoardIcon />
            </span>
            <span className="nav-title">{t("board")}</span>
          </Link>
          <div className="nav-rule" aria-hidden />
        </nav>

        {rail ? (
          <div className="sidebar-page-rail">
            <div className="sidebar-page-rail-scroll">
              <div className="sidebar-page-rail-list" ref={railListRef}>
                {pages.map((p) => {
                  const label = p.title || tc("untitled");
                  return (
                    <Link
                      key={p.id}
                      href={`/w/${workspaceId}/p/${p.id}`}
                      onNavigate={beforeNavigate}
                      className="nav-item"
                      data-active={p.id === pageId}
                      data-tooltip={label}
                      aria-label={label}
                    >
                      <span className="nav-ico" aria-hidden>
                        <span className="sidebar-page-mark">
                          {p.icon ?? label.slice(0, 1).toUpperCase()}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              <CompactRailScroll target={railListRef} itemCount={pages.length} />
            </div>
            {canWrite && (
              <button
                type="button"
                className="nav-item"
                data-tooltip={td("newPageShort")}
                aria-label={td("newPageShort")}
                onClick={() => void createPage()}
              >
                <span className="nav-ico">
                  <PlusIcon />
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="sidebar-pages">
            <div className="sidebar-pages-head">
              <span>{td("navPages")}</span>
            </div>
            <OverlayScroll contentClassName="sidebar-page-list">
              {pages.length === 0 ? (
                <p className="sidebar-pages-empty">{td("pagesEmptyHint")}</p>
              ) : (
                pages.map((p) => {
                  const label = p.title || tc("untitled");
                  return (
                    <Link
                      key={p.id}
                      href={`/w/${workspaceId}/p/${p.id}`}
                      onNavigate={beforeNavigate}
                      className="nav-item sidebar-page-item"
                      data-active={p.id === pageId}
                      data-tooltip={label}
                    >
                      <span className="sidebar-page-mark" aria-hidden>
                        {p.icon ?? label.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="nav-title">{label}</span>
                    </Link>
                  );
                })
              )}
            </OverlayScroll>
            {canWrite && (
              <button type="button" className="sidebar-new-page" onClick={() => void createPage()}>
                <PlusIcon />
                <span>{td("newPageShort")}</span>
              </button>
            )}
          </div>
        )}

        <div className="sidebar-tools">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setChromePersist(nextChrome)}
            aria-controls="relay-sidebar-nav"
            data-tooltip={tb("chromeSwitch", { mode: nextChromeLabel })}
            aria-label={tb("chromeSwitch", { mode: nextChromeLabel })}
          >
            <ChevronIcon collapsed={rail} />
            {!rail && <span>{nextChromeLabel}</span>}
          </button>
        </div>

        <div className="sidebar-foot">
          {me && (
            <div
              className="account-chip"
              data-tooltip={rail ? `${me.name} · ${me.email}` : undefined}
            >
              <button
                type="button"
                className="account-chip-main"
                onClick={() => {
                  setAccountError(null);
                  setAccountOpen(true);
                }}
                aria-label={me.name}
              >
                <UserAvatar name={me.name} url={me.avatarUrl} className="account-avatar" />
                {!rail && (
                  <span className="account-meta">
                    <span className="account-name">{me.name}</span>
                    <span className="account-sub">
                      <span className="account-email">{me.email}</span>
                    </span>
                  </span>
                )}
              </button>
              {!rail && (
                <button
                  type="button"
                  className="account-logout"
                  data-tooltip={tc("logout")}
                  aria-label={tc("logout")}
                  onClick={() => void logout()}
                >
                  <LogoutIcon />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <HelpPanel />

      <WorkspaceShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        workspaceId={workspaceId}
        workspaceName={shownWorkspaceName}
        role={role}
        pageId={pageId}
        publicId={publicId}
        publicUrl={publicUrl}
        onTogglePublish={togglePublish}
      />

      <SearchPalette
        open={compassOpen}
        onClose={() => setCompassOpen(false)}
        query={compassQ}
        loading={searchLoading}
        onQueryChange={setCompassQ}
        label={`${t("searchTitle")} · ${searchHint}`}
        placeholder={t("searchPlaceholder")}
        actionsLabel={td("paletteActions")}
        pagesLabel={t("pages")}
        emptyLabel={td("pagesSearchEmpty")}
        emptyHint={td("pagesSearchEmptyHint")}
        actions={[
          {
            id: "board",
            title: t("infiniteBoard"),
            onSelect: () => router.push(`/w/${workspaceId}/board`),
          },
          {
            id: "new",
            title: t("newPageTitle"),
            onSelect: () => void createPage(),
          },
        ]}
        hits={searchResults.map((r) => ({
          id: r.pageId,
          title: r.title,
          snippet: r.snippet,
        }))}
        onOpenHit={(id) => router.push(`/w/${workspaceId}/p/${id}`)}
      />

      {accountOpen && me && (
        <div className="account-sheet">
          <button
            type="button"
            className="account-sheet-scrim"
            aria-label={t("close")}
            onClick={() => setAccountOpen(false)}
          />
          <div className="account-sheet-panel" role="dialog" aria-label={t("accountSheetTitle")}>
            <h1>{t("accountSheetTitle")}</h1>
            <AccountSettings
              user={me}
              busy={accountBusy}
              error={accountError}
              onSave={async (input) => {
                setAccountBusy(true);
                setAccountError(null);
                try {
                  const body: { name: string; avatarUrl?: string | null } = { name: input.name };
                  if (input.avatarUrl !== undefined) body.avatarUrl = input.avatarUrl;
                  const res = await fetch("/api/v1/auth/me", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(body),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error((data as { message?: string }).message || t("historyRestoreFailed"));
                  }
                  const next = (data as { user?: typeof me }).user;
                  if (next) setMe({ ...me, ...next });
                } catch (err) {
                  setAccountError(err instanceof Error ? err.message : t("historyRestoreFailed"));
                } finally {
                  setAccountBusy(false);
                }
              }}
              onLink={(provider) => {
                const next = pathname.startsWith("/") ? pathname : `/w/${workspaceId}/board`;
                window.location.href = `/api/v1/auth/oauth/${provider}?intent=link&next=${encodeURIComponent(next)}`;
              }}
              onUnlink={async (provider) => {
                setAccountBusy(true);
                setAccountError(null);
                try {
                  const res = await fetch(`/api/v1/auth/me/providers/${provider}`, {
                    method: "DELETE",
                    credentials: "include",
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error((data as { message?: string }).message || t("historyRestoreFailed"));
                  }
                  setMe({
                    ...me,
                    providers: (me.providers ?? []).filter((p) => p !== provider),
                  });
                } catch (err) {
                  setAccountError(err instanceof Error ? err.message : t("historyRestoreFailed"));
                } finally {
                  setAccountBusy(false);
                }
              }}
              onLogout={() => void logout()}
            />
          </div>
        </div>
      )}

      <VersionHistory
        open={historyTarget !== null}
        title={
          historyTarget?.pageId === null
            ? t("infiniteBoard")
            : historyTarget?.pageId === pageId
              ? title
              : t("untitled")
        }
        canRestore={canWrite}
        initialId={historyTarget?.entryId}
        client={historyClient(workspaceId, historyTarget?.pageId ?? null)}
        loadCurrent={() => loadHistoryCurrent(workspaceId, historyTarget?.pageId ?? null)}
        renderBoard={(board) => (
          <InfiniteBoard
            key={historyTarget?.entryId ?? "board"}
            initialSnapshot={board as BoardSnapshot}
            editable={false}
          />
        )}
        onClose={() => setHistoryTarget(null)}
        onRestored={() => {
          if (historyTarget?.pageId === (pageId ?? null)) batch.discardPending();
          window.location.reload();
        }}
      />
    </div>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11A2 2 0 0 0 6.5 19.5H10"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M10.5 12H19.5M16.5 8.5 20 12l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="nav-ico-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="nav-ico-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 3.7 3.7" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg
      className="nav-ico-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="nav-ico-svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
    >
      <path d="M15 6 9 12l6 6" />
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 9V6.5A2 2 0 0 1 6.5 4.5H9M15 4.5h2.5a2 2 0 0 1 2 2V9M19.5 15v2.5a2 2 0 0 1-2 2H15M9 19.5H6.5a2 2 0 0 1-2-2V15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
