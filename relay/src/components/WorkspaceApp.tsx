"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BlockEditor } from "@/editor/BlockEditor";
import { InfiniteBoard, type BoardSnapshot } from "@/components/InfiniteBoard";
import type { Doc } from "@/domain/blocks/schema";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { WebWorkspaceSwitcher } from "@/components/WebWorkspaceSwitcher";
import { WorkspaceShareModal } from "@/components/WorkspaceShareModal";
import { DialogProvider, useDialog } from "@/components/DialogHost";
import { useTranslations } from "next-intl";
import { workspaceDisplayName } from "@/domain/workspaces/naming";

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

type PulseEvent = {
  id: number;
  action: string;
  actorName: string | null;
  createdAt: string;
  meta: { title?: string; email?: string } | null;
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
}: Props) {
  const t = useTranslations("app");
  const tc = useTranslations("common");
  const dialog = useDialog();
  const router = useRouter();
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
  const [pulse, setPulse] = useState<PulseEvent[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [compassQ, setCompassQ] = useState("");
  const [searchResults, setSearchResults] = useState<
    { pageId: string; title: string; snippet: string }[]
  >([]);
  const [mode, setMode] = useState<ViewMode>(isWorkspaceBoard ? "board" : defaultMode);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [chrome, setChrome] = useState<"expanded" | "rail" | "focus">("expanded");
  const [peek, setPeek] = useState(false);
  const [peekTop, setPeekTop] = useState(false);
  const [focusHint, setFocusHint] = useState(false);
  const [focusHintHide, setFocusHintHide] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const peekHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef<ViewMode>(isWorkspaceBoard ? "board" : defaultMode);
  const updatedAtRef = useRef(initialPage?.updatedAt ?? "");
  const skipSaveRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("relay.web.chrome");
      if (saved === "expanded" || saved === "rail" || saved === "focus") setChrome(saved);
    } catch {
      /* ignore */
    }
  }, []);

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
    }, 480);
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
    }, 480);
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
      if (e.key === "Escape") setPageMenuOpen(false);
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
        const data = (await res.json()) as { user?: { name?: string; email?: string } };
        if (!cancelled && data.user) {
          setMe({ name: data.user.name ?? "", email: data.user.email ?? "" });
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

  const refreshPulse = useCallback(async () => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/pulse`);
    if (!res.ok) return;
    const data = await res.json();
    setPulse(data.events);
  }, [workspaceId]);

  useEffect(() => {
    void refreshPulse();
  }, [refreshPulse, pageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCompassOpen(true);
      }
      if (e.key === "Escape") {
        if (compassOpen || shareOpen) {
          setCompassOpen(false);
          setShareOpen(false);
          return;
        }
        if (chrome === "focus") setChromePersist("expanded");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chrome, compassOpen, shareOpen]);

  useEffect(() => {
    if (!compassOpen || compassQ.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/search?q=${encodeURIComponent(compassQ)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setSearchResults(data.results);
    }, 200);
    return () => clearTimeout(t);
  }, [compassOpen, compassQ, workspaceId]);

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
      void refreshPulse();
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
    void refreshPulse();
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
    void refreshPulse();
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

  function labelAction(action: string) {
    const map: Record<string, string> = {
      "page.create": t("actionPageCreate"),
      "page.update": t("actionPageUpdate"),
      "page.publish": t("actionPagePublish"),
      "page.prompt": t("actionPagePrompt"),
      "member.invite": t("actionMemberInvite"),
      "workspace.create": t("actionWorkspaceCreate"),
      "board.update": t("actionBoardUpdate"),
    };
    return map[action] ?? action;
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

      <aside
        className="relay-sidebar"
        onMouseEnter={() => {
          if (chrome === "focus") showSidebarPeek();
        }}
        onMouseLeave={() => {
          if (chrome === "focus") scheduleHideSidebarPeek();
        }}
      >
        <div className="relay-sidebar-brand">
          <BrandLockup size={chrome === "rail" ? 20 : 22} />
          {chrome !== "rail" && (
            <button
              type="button"
              className="relay-icon-btn relay-icon-btn-surface relay-chrome-btn"
              title={chrome === "focus" ? t("exitFocus") : t("focusMode")}
              aria-label={chrome === "focus" ? t("exitFocus") : t("focusMode")}
              data-active={chrome === "focus" || undefined}
              onClick={toggleFocus}
            >
              <FocusIcon />
            </button>
          )}
        </div>

        <WebWorkspaceSwitcher
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          ownerName={ownerName}
          collapsed={chrome === "rail"}
          onExpand={() => setChromePersist("expanded")}
          onInvite={() => {
            setShareOpen(true);
            void markChecklist("openedShare");
          }}
        />

        <Link
          href={`/w/${workspaceId}/board`}
          className="relay-page-link relay-board-nav"
          data-active={isWorkspaceBoard}
          title={t("infiniteBoard")}
        >
          <span className="icon">∞</span>
          <span className="relay-ellipsis">{t("infiniteBoard")}</span>
        </Link>
        <button
          type="button"
          className="relay-page-link"
          title={t("invitePeople")}
          onClick={() => {
            setShareOpen(true);
            void markChecklist("openedShare");
          }}
        >
          <span className="icon" aria-hidden>
            <PeopleIcon />
          </span>
          <span className="relay-ellipsis">{t("invitePeople")}</span>
        </button>

        <div className="relay-nav-row">
          <div className="relay-nav-label">{t("pages")}</div>
          {canWrite && (
            <button
              type="button"
              className="relay-add-page"
              onClick={() => void createPage()}
              title={t("newPageTitle")}
              aria-label={t("newPageTitle")}
            >
              <PlusIcon />
            </button>
          )}
        </div>

        <div className="relay-page-list">
          {pages.length === 0 && (
            <div className="relay-empty-side">{t("emptyPages")}</div>
          )}
          {pages.map((p) => {
            const label = p.title || tc("untitled");
            return (
              <div
                key={p.id}
                className="relay-page-row"
                data-active={p.id === pageId || undefined}
              >
                <Link
                  href={`/w/${workspaceId}/p/${p.id}`}
                  className="relay-page-link"
                  data-active={p.id === pageId}
                  title={label}
                >
                  <span className="icon">{p.icon ?? "◇"}</span>
                  <span className="relay-ellipsis">{label}</span>
                </Link>
                {canWrite && chrome === "expanded" && (
                  <button
                    type="button"
                    className="relay-page-delete"
                    title={tc("delete")}
                    aria-label={tc("delete")}
                    onClick={() => void deletePage(p.id, label)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="relay-sidebar-foot">
          {checklist && !checklist.dismissed && chrome === "expanded" && (
            <div className="relay-checklist">
              <div className="relay-checklist-head">
                <h3>{t("firstSteps")}</h3>
                <button
                  type="button"
                  className="relay-link-btn"
                  onClick={() => void markChecklist("dismissed")}
                >
                  {t("hide")}
                </button>
              </div>
              <div className="relay-check-item" data-done={checklist.editedPage}>
                <span>{checklist.editedPage ? "✓" : "1"}</span>
                <span>{t("stepDraw")}</span>
              </div>
              <div className="relay-check-item" data-done={checklist.usedSlashOrPrompt}>
                <span>{checklist.usedSlashOrPrompt ? "✓" : "2"}</span>
                <span>{t("stepSlash")}</span>
              </div>
              <div className="relay-check-item" data-done={checklist.openedShare}>
                <span>{checklist.openedShare ? "✓" : "3"}</span>
                <span>{t("stepShare")}</span>
              </div>
            </div>
          )}

          {chrome === "expanded" && (
            <div className="relay-pulse">
              <div className="relay-nav-label">{t("pulse")}</div>
              {pulse.length === 0 && (
                <div className="relay-pulse-item">{t("pulseEmpty")}</div>
              )}
              {pulse.slice(0, 3).map((ev) => (
                <div key={ev.id} className="relay-pulse-item">
                  <strong>{ev.actorName ?? tc("someone")}</strong> {labelAction(ev.action)}
                </div>
              ))}
            </div>
          )}

          {me && (
            <div className="relay-account">
              <span className="relay-account-avatar" aria-hidden>
                {me.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="relay-account-copy">
                <span className="relay-account-name">{me.name}</span>
                <span className="relay-account-email">{me.email}</span>
              </span>
              <button
                type="button"
                className="relay-icon-btn relay-icon-btn-surface"
                title={tc("logout")}
                aria-label={tc("logout")}
                onClick={() => void logout()}
              >
                <LogoutIcon />
              </button>
            </div>
          )}

          <button
            type="button"
            className="relay-sidebar-collapse"
            onClick={() =>
              setChromePersist(chrome === "expanded" ? "rail" : chrome === "rail" ? "expanded" : "expanded")
            }
            title={chrome === "rail" ? t("sidebarExpand") : t("sidebarCollapse")}
            aria-label={chrome === "rail" ? t("sidebarExpand") : t("sidebarCollapse")}
          >
            <CollapseIcon collapsed={chrome !== "expanded"} />
            <span>{chrome === "rail" ? t("sidebarExpand") : t("sidebarCollapse")}</span>
          </button>
        </div>
      </aside>

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
              <div className="relay-mode-switch" role="tablist" aria-label={t("mode")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "board"}
                  data-active={mode === "board"}
                  onClick={() => setMode("board")}
                >
                  {t("board")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "text"}
                  data-active={mode === "text"}
                  onClick={() => setMode("text")}
                >
                  {t("text")}
                </button>
              </div>
            )}
            <span className="relay-save">{saveLabel}</span>
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
          </div>

          <div className="relay-topbar-actions">
            {!isWorkspaceBoard && canWrite && (
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
                    <button
                      type="button"
                      className="relay-page-menu-item"
                      data-danger="true"
                      role="menuitem"
                      onClick={() => pageId && void deletePage(pageId, title)}
                    >
                      {t("pageMenuDelete")}
                    </button>
                  </div>
                )}
              </div>
            )}
            {isWorkspaceBoard && chrome !== "focus" && (
              <button
                type="button"
                className="relay-icon-btn relay-icon-btn-surface"
                title={t("focusMode")}
                aria-label={t("focusMode")}
                onClick={toggleFocus}
              >
                <FocusIcon />
              </button>
            )}
            <button
              type="button"
              className="relay-icon-btn relay-icon-btn-surface"
              onClick={() => setCompassOpen(true)}
              title={t("searchTitle")}
              aria-label={tc("search")}
            >
              ⌕
            </button>
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
            <LanguageToggle variant="toolbar" />
            <ThemeToggle variant="toolbar" />
          </div>
        </div>

        {(isWorkspaceBoard || mode === "board") && (
          <div className="relay-board-wrap">
            <InfiniteBoard
              key={isWorkspaceBoard ? `ws-${workspaceId}` : `pg-${pageId}-board`}
              editable={canWrite}
              initialSnapshot={isWorkspaceBoard ? wsBoard : pageBoard}
              syncRoomId={
                canWrite
                  ? isWorkspaceBoard
                    ? `ws-${workspaceId}`
                    : `pg-${pageId}`
                  : undefined
              }
              onChange={
                isWorkspaceBoard ? saveWorkspaceBoardSnapshot : savePageBoardSnapshot
              }
            />
          </div>
        )}

        {!isWorkspaceBoard && mode === "text" && initialPage && (
          <div className="relay-page">
            <BlockEditor
              content={content}
              editable={canWrite}
              onChange={setContent}
              onSlashUsed={() => void markChecklist("usedSlashOrPrompt")}
              onRunPrompt={runPrompt}
            />
          </div>
        )}
      </main>

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

      {compassOpen && (
        <div className="relay-modal-backdrop" onClick={() => setCompassOpen(false)}>
          <div className="relay-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t("compass")}</h2>
            <input
              className="relay-input"
              autoFocus
              placeholder={t("searchPlaceholder")}
              value={compassQ}
              onChange={(e) => setCompassQ(e.target.value)}
            />
            <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
              <button
                type="button"
                className="relay-page-link"
                onClick={() => {
                  setCompassOpen(false);
                  router.push(`/w/${workspaceId}/board`);
                }}
              >
                ∞ {t("openBoard")}
              </button>
              <button type="button" className="relay-page-link" onClick={() => void createPage()}>
                + {t("newPageTitle")}
              </button>
              {searchResults.map((r) => (
                <button
                  key={r.pageId}
                  type="button"
                  className="relay-page-link"
                  onClick={() => {
                    setCompassOpen(false);
                    router.push(`/w/${workspaceId}/p/${r.pageId}`);
                  }}
                >
                  <div>
                    <div>{r.title}</div>
                    <div className="relay-muted" style={{ fontSize: "0.78rem" }}>
                      {r.snippet}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 19v-1.2A2.8 2.8 0 0 0 13.2 15H7.8A2.8 2.8 0 0 0 5 17.8V19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="10.5" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19 19v-1.1a2.4 2.4 0 0 0-1.7-2.3M15.2 7.2a2.4 2.4 0 0 1 0 3.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
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

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      style={{ transform: collapsed ? "rotate(180deg)" : undefined, transition: "transform .2s ease" }}
    >
      <path d="M8.5 3.5 5 7l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m2 0v12a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
