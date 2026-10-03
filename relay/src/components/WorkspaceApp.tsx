"use client";

import Link from "next/link";
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
  const [pageBoard, setPageBoard] = useState<BoardSnapshot | null>(
    initialPage?.board ?? null,
  );
  const [wsBoard, setWsBoard] = useState<BoardSnapshot | null>(workspaceBoard);
  const [updatedAt, setUpdatedAt] = useState(initialPage?.updatedAt ?? "");
  const [publicId, setPublicId] = useState(initialPage?.publicId ?? null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [checklist, setChecklist] = useState(initialChecklist);
  const [pulseSeen, setPulseSeen] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [compassQ, setCompassQ] = useState("");
  const [searchResults, setSearchResults] = useState<
    { pageId: string; title: string; snippet: string }[]
  >([]);
  const [mode, setMode] = useState<ViewMode>(isWorkspaceBoard ? "board" : defaultMode);
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
  const [historyTarget, setHistoryTarget] = useState<{ pageId: string | null; entryId: string } | null>(
    null,
  );
  const [activityFocus, setActivityFocus] = useState<ActivityFocus | null>(null);
  const activityFocusTimer = useRef<number | null>(null);
  const [chrome, setChrome] = useState<"expanded" | "rail" | "focus">("expanded");
  const rail = chrome === "rail";
  const [peek, setPeek] = useState(false);
  const [peekTop, setPeekTop] = useState(false);
  const [focusHint, setFocusHint] = useState(false);
  const [focusHintHide, setFocusHintHide] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "public" | null>(null);
  const peekHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef<ViewMode>(isWorkspaceBoard ? "board" : defaultMode);
  const updatedAtRef = useRef(initialPage?.updatedAt ?? "");
  const skipSaveRef = useRef(false);
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
    setPeek(false);
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

  function showSidebarPeek() {
    if (peekHideTimer.current) {
      clearTimeout(peekHideTimer.current);
      peekHideTimer.current = null;
    }
    setPeek(true);
  }

  function scheduleHideSidebarPeek() {
    if (peekHideTimer.current) clearTimeout(peekHideTimer.current);
    peekHideTimer.current = setTimeout(() => {
      setPeek(false);
      peekHideTimer.current = null;
    }, 220);
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
    const bump = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 280);
    return () => window.clearTimeout(bump);
  }, [chrome]);

  useEffect(() => {
    if (!pageMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!pageMenuRef.current?.contains(e.target as Node)) setPageMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPageMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pageMenuOpen]);

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
    updatedAtRef.current = updatedAt;
  }, [updatedAt]);

  useEffect(() => {
    setMode(isWorkspaceBoard ? "board" : defaultMode);
    setTitle(initialPage?.title ?? "");
    setContent(initialPage?.content ?? { type: "doc", content: [{ type: "paragraph" }] });
    setPageBoard(initialPage?.board ?? null);
    setUpdatedAt(initialPage?.updatedAt ?? "");
    setPublicId(initialPage?.publicId ?? null);
    updatedAtRef.current = initialPage?.updatedAt ?? "";
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
      setSearchResults(
        pages.slice(0, 8).map((p) => ({ pageId: p.id, title: p.title, snippet: "" })),
      );
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/search?q=${encodeURIComponent(compassQ)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setSearchResults(data.results);
    }, 200);
    return () => clearTimeout(timer);
  }, [compassOpen, compassQ, workspaceId, pages]);

  // Автосохранение текста
  useEffect(() => {
    if (!pageId || !canWrite || !updatedAtRef.current || mode !== "text") return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const base = updatedAtRef.current;
      const res = await fetch(`/api/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, baseUpdatedAt: base }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setUpdatedAt(data.details?.serverUpdatedAt ?? base);
        setSaveState("error");
        return;
      }
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      updatedAtRef.current = data.updatedAt;
      setUpdatedAt(data.updatedAt);
      setSaveState("saved");
      void markChecklist("editedPage");
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, title } : p)));
      bumpActivity();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, pageId, canWrite, mode, markChecklist]);

  // Сохранение названия на холсте (в тексте title уходит вместе с content)
  useEffect(() => {
    if (!pageId || !canWrite || !updatedAtRef.current || mode === "text") return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const base = updatedAtRef.current;
      const res = await fetch(`/api/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, baseUpdatedAt: base }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setUpdatedAt(data.details?.serverUpdatedAt ?? base);
        setSaveState("error");
        return;
      }
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      updatedAtRef.current = data.updatedAt;
      setUpdatedAt(data.updatedAt);
      setSaveState("saved");
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, title } : p)));
      bumpActivity();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, pageId, canWrite, mode]);

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

  async function saveWorkspaceBoardSnapshot(board: BoardSnapshot) {
    if (!canWrite) return;
    setSaveState("saving");
    setWsBoard(board);
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/board`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board }),
    });
    setSaveState(res.ok ? "saved" : "error");
    if (res.ok) {
      void markChecklist("editedPage");
      bumpActivity();
    }
  }

  async function savePageBoardSnapshot(board: BoardSnapshot) {
    if (!pageId || !canWrite || !updatedAtRef.current) return;
    setSaveState("saving");
    setPageBoard(board);
    const res = await fetch(`/api/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board,
        baseUpdatedAt: updatedAtRef.current,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaveState("error");
      return;
    }
    updatedAtRef.current = data.updatedAt;
    setUpdatedAt(data.updatedAt);
    setSaveState("saved");
    void markChecklist("editedPage");
    bumpActivity();
  }

  async function runPrompt(prompt: string) {
    if (!pageId) return;
    void markChecklist("usedSlashOrPrompt");
    const res = await fetch(`/api/v1/pages/${pageId}/run-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) return;
    skipSaveRef.current = true;
    setContent(data.content);
    updatedAtRef.current = data.updatedAt;
    setUpdatedAt(data.updatedAt);
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
    setPageMenuOpen(false);
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

  function copyPageText(text: string, kind: "link" | "public") {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(null), 1400);
    });
  }

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
      data-peek={peek || undefined}
      data-peek-top={peekTop || undefined}
    >
      {chrome === "focus" && (
        <>
          <div className="relay-edge-peek" onMouseEnter={showSidebarPeek} aria-hidden />
          <div className="relay-edge-peek-top" onMouseEnter={showTopPeek} aria-hidden />
        </>
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
                className="relay-topbar-title"
                value={title}
                placeholder={t("pageTitlePlaceholder")}
                disabled={!canWrite}
                aria-label={t("pageTitlePlaceholder")}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
            <span className="relay-save" data-state={saveState}>
              {saveLabel}
            </span>
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
            {!isWorkspaceBoard && (
              <div className="relay-page-menu" ref={pageMenuRef}>
                <button
                  type="button"
                  className="relay-icon-btn relay-icon-btn-surface"
                  title={t("pageMenu")}
                  aria-label={t("pageMenu")}
                  aria-expanded={pageMenuOpen}
                  onClick={() => setPageMenuOpen((v) => !v)}
                >
                  <MoreIcon />
                </button>
                {pageMenuOpen && (
                  <div className="relay-page-menu-pop" role="menu">
                    {pageUrl && (
                      <button
                        type="button"
                        className="relay-page-menu-item"
                        role="menuitem"
                        onClick={() => copyPageText(pageUrl, "link")}
                      >
                        {copied === "link" ? t("pageMenuCopied") : t("pageMenuCopyLink")}
                      </button>
                    )}
                    {publicUrl && (
                      <button
                        type="button"
                        className="relay-page-menu-item"
                        role="menuitem"
                        onClick={() => copyPageText(publicUrl, "public")}
                      >
                        {copied === "public" ? t("pageMenuCopied") : t("pageMenuCopyPublic")}
                      </button>
                    )}
                    {canWrite && (
                      <>
                        <div className="relay-page-menu-sep" role="separator" />
                        <button
                          type="button"
                          className="relay-page-menu-item"
                          data-danger="true"
                          role="menuitem"
                          onClick={() => pageId && void deletePage(pageId, title)}
                        >
                          {t("pageMenuDelete")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="relay-topbar-app">
              <ActivityDisclosure
                variant="chrome"
                items={[]}
                unread={false}
                labelAction={labelAction}
                scopeTitle={isWorkspaceBoard ? t("infiniteBoard") : title}
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
          <div className="relay-board-wrap">
            <InfiniteBoard
              key={isWorkspaceBoard ? `ws-${workspaceId}` : `pg-${pageId}-board`}
              editable={canWrite}
              initialSnapshot={isWorkspaceBoard ? wsBoard : pageBoard}
              syncRoomId={isWorkspaceBoard ? `ws-${workspaceId}` : `pg-${pageId}`}
              viewerId={viewerId}
              onChange={
                isWorkspaceBoard ? saveWorkspaceBoardSnapshot : savePageBoardSnapshot
              }
              focusShapeIds={activityFocus?.shapeIds}
            />
          </div>
        )}

        {!isWorkspaceBoard && mode === "text" && initialPage && (
          <OverlayScroll arrows className="relay-page-scroll" contentClassName="relay-page">
            <BlockEditor
              content={content}
              editable={canWrite}
              onChange={setContent}
              onSlashUsed={() => void markChecklist("usedSlashOrPrompt")}
              onRunPrompt={runPrompt}
              focusPhrases={activityFocus?.phrases}
              focusBlockType={activityFocus?.blockType}
              onActivityFocusDismiss={() => setActivityFocus(null)}
            />
          </OverlayScroll>
        )}
      </main>

      <aside
        className="sidebar relay-sidebar"
        data-collapsed={rail ? "true" : "false"}
        onMouseEnter={() => {
          if (chrome === "focus") showSidebarPeek();
        }}
        onMouseLeave={() => {
          if (chrome === "focus") scheduleHideSidebarPeek();
        }}
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
            title={`${tc("search")} · ${searchHint}`}
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
            className="nav-item"
            data-active={isWorkspaceBoard}
            title={td("navBoardHint")}
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
                      className="nav-item"
                      data-active={p.id === pageId}
                      title={label}
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
                title={td("newPageShort")}
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
                      className="nav-item sidebar-page-item"
                      data-active={p.id === pageId}
                      title={label}
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
            title={tb("chromeSwitch", { mode: nextChromeLabel })}
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
              title={rail ? `${me.name} · ${me.email}` : undefined}
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
                  title={tc("logout")}
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
        onRestored={() => window.location.reload()}
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

function MoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

