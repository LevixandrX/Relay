import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { BlockEditor } from "../editor/BlockEditor";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { emptyDoc, type BoardSnapshot, type Doc } from "../lib/types";
import { publicAppOrigin } from "../lib/app-origin";
import { WorkspacePresence } from "./WorkspacePresence";
import { useDialog } from "./DialogHost";
import { ContentModeSwitch } from "@relay-mode-switch";
import { OverlayScroll } from "@relay-board/CompactRailScroll";
import {
  clearActivityFocus,
  readActivityFocus,
  subscribeActivityFocus,
  type ActivityFocus,
} from "@relay-board/activity-focus";

type Mode = "text" | "board";

export function PageView({
  pageId,
  onBack,
}: {
  pageId: string;
  onBack: () => void;
}) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const ta = useTranslations("app");
  const { loadPage, updatePage, deletePage, offline, mode: wsMode, activeWorkspaceId } = useWorkspace();
  const auth = useAuth();
  const dialog = useDialog();
  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Doc>(emptyDoc());
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "loading" | "error">(
    "loading",
  );
  const [missing, setMissing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activityFocus, setActivityFocus] = useState<ActivityFocus | null>(null);
  const activityFocusMode = useRef<Mode | null>(null);
  const activityFocusTimer = useRef<number | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const focus = readActivityFocus(pageId);
    if (!focus) return;
    setActivityFocus(focus);
    activityFocusMode.current = focus.mode;
    setMode(focus.mode);
    clearActivityFocus();
    if (activityFocusTimer.current !== null) window.clearTimeout(activityFocusTimer.current);
    activityFocusTimer.current =
      focus.mode === "board" ? window.setTimeout(() => setActivityFocus(null), 5000) : null;
    return () => {
      if (activityFocusTimer.current !== null) window.clearTimeout(activityFocusTimer.current);
    };
  }, [pageId]);

  useEffect(
    () =>
      subscribeActivityFocus((focus) => {
        if (focus.pageId !== pageId) return;
        setActivityFocus(focus);
        setMode(focus.mode);
        clearActivityFocus();
        if (activityFocusTimer.current !== null) window.clearTimeout(activityFocusTimer.current);
        activityFocusTimer.current =
          focus.mode === "board" ? window.setTimeout(() => setActivityFocus(null), 5000) : null;
      }),
    [pageId],
  );

  useEffect(() => {
    if (wsMode !== "cloud" || !auth.token || !activeWorkspaceId) return;
    void api(`/workspaces/${activeWorkspaceId}/views`, {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ pageId }),
    }).catch(() => undefined);
  }, [wsMode, auth.token, activeWorkspaceId, pageId]);

  useEffect(() => {
    function onRestored(event: Event) {
      const id = (event as CustomEvent<{ pageId?: string | null }>).detail?.pageId;
      if (id !== pageId) return;
      void loadPage(pageId).then((p) => {
        if (!p) return;
        setTitle(p.title);
        setContent(p.content);
        setBoard(p.board);
        setSaveState("saved");
      });
    }
    window.addEventListener("relay:history-restored", onRestored);
    return () => window.removeEventListener("relay:history-restored", onRestored);
  }, [pageId, loadPage]);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;
    setSaveState("loading");
    void loadPage(pageId).then((p) => {
      if (cancelled) return;
      if (!p) {
        setMissing(true);
        setSaveState("error");
        return;
      }
      setMissing(false);
      setTitle(p.title);
      setContent(p.content);
      setBoard(p.board);
      setMode(activityFocusMode.current ?? "text");
      activityFocusMode.current = null;
      setSaveState("saved");
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, loadPage]);

  if (missing) {
    return (
      <section className="card">
        <p className="muted">{t("pageNotFound")}</p>
        <button type="button" className="btn" onClick={onBack}>
          {t("backToList")}
        </button>
      </section>
    );
  }

  if (saveState === "loading") {
    return (
      <section className="card">
        <p className="muted">{tc("loading")}</p>
      </section>
    );
  }

  function scheduleTitle(next: string) {
    setTitle(next);
    setSaveState("saving");
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      void updatePage(pageId, { title: next.trim() || tc("untitled") })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 400);
  }

  function scheduleContent(doc: Doc) {
    setContent(doc);
    setSaveState("saving");
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => {
      void updatePage(pageId, { content: doc })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 500);
  }

  function onBoardChange(next: BoardSnapshot) {
    setBoard(next);
    setSaveState("saving");
    void updatePage(pageId, { board: next })
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }

  const pageUrl =
    wsMode === "cloud" && activeWorkspaceId
      ? `${publicAppOrigin()}/w/${activeWorkspaceId}/p/${pageId}`
      : null;

  function copyPageLink() {
    if (!pageUrl) return;
    void navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1400);
    });
  }

  async function removePage() {
    const ok = await dialog.confirm({
      title: ta("deletePageConfirm", { title: title || tc("untitled") }),
      confirmLabel: tc("delete"),
      danger: true,
    });
    if (!ok) return;
    setMenuOpen(false);
    await deletePage(pageId);
    onBack();
  }

  return (
    <div className="workspace-fill">
      <div className="toprow workspace-bar">
        <div className="page-title" style={{ flex: 1, minWidth: 0 }}>
          <button type="button" className="btn" onClick={onBack}>
            ←
          </button>
          <input
            className="title-input"
            value={title}
            onChange={(e) => scheduleTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            aria-label={t("titleAria")}
          />
          <WorkspacePresence save={saveState} />
        </div>
        <ContentModeSwitch
          value={mode}
          onChange={setMode}
          boardLabel={ta("board")}
          textLabel={ta("text")}
        />
        <div className="page-menu" ref={menuRef}>
          <button
            type="button"
            className="page-menu-btn"
            title={ta("pageMenu")}
            aria-label={ta("pageMenu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreIcon />
          </button>
          {menuOpen && (
            <div className="page-menu-pop" role="menu">
              {pageUrl && (
                <button type="button" className="page-menu-item" role="menuitem" onClick={copyPageLink}>
                  {copied ? ta("pageMenuCopied") : ta("pageMenuCopyLink")}
                </button>
              )}
              {pageUrl && <div className="page-menu-sep" role="separator" />}
              <button
                type="button"
                className="page-menu-item"
                data-danger="true"
                role="menuitem"
                onClick={() => void removePage()}
              >
                {ta("pageMenuDelete")}
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "text" ? (
        <OverlayScroll arrows className="editor-card-scroll" contentClassName="card editor-card">
          <BlockEditor
            content={content}
            onChange={scheduleContent}
            focusPhrases={activityFocus?.phrases}
            focusBlockType={activityFocus?.blockType}
            onActivityFocusDismiss={() => setActivityFocus(null)}
          />
        </OverlayScroll>
      ) : (
        <div className="board-wrap">
          <InfiniteBoard
            key={`page-board-${pageId}`}
            initialSnapshot={board}
            syncRoomId={!offline ? `pg-${pageId}` : undefined}
            onChange={onBoardChange}
            focusShapeIds={activityFocus?.shapeIds}
          />
        </div>
      )}
    </div>
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
