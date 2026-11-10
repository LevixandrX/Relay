import { ArrowLeft } from "lucide-react";
import { LoadingIndicator } from "@relay-ui/LoadingIndicator";
import { PageActions } from "@relay-ui/PageActions";
import { useSaveFeedback } from "@relay-ui/SaveIndicator";
import { useViewMotion } from "@relay-ui/use-view-motion";
import { useSaveBatch } from "../../../src/lib/use-save-batch";
import {nativeSaveCode} from '../lib/save-code';
import { guestCommentRequest } from "@relay-editor/guest-comments";
import {guestResourceRequest} from '@relay-editor/guest-resources';
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations, useLocale } from "use-intl";
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
type PageDraft = { title?: string; readContent?: () => Doc; readBoard?: () => BoardSnapshot };

export function PageView({
  pageId,
  onBack,
}: {
  pageId: string;
  onBack: () => void;
}) {
  const t = useTranslations("desktop");
  const locale = useLocale();
  const tc = useTranslations("common");
  const ta = useTranslations("app");
  const { loadPage, movePageBlock, updatePage, deletePage, createPage, offline, mode: wsMode, activeWorkspaceId, activeRole, pages } = useWorkspace();
  const canWrite = wsMode === "guest" || activeRole === "owner" || activeRole === "editor";
  const auth = useAuth();
  const dialog = useDialog();
  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Doc>(emptyDoc());
  const [contentPageId, setContentPageId] = useState<string | null>(null);
  const modeMotion = useViewMotion<HTMLDivElement>(
    contentPageId === pageId ? `${pageId}:${mode}` : null,
    mode === "text" ? "forward" : "back",
  );
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [saveState, setSaveState, saveRevision] = useSaveFeedback();
  const batch = useSaveBatch<PageDraft>(`${wsMode}:${activeWorkspaceId}:${pageId}`);
  const currentBatch = useRef(batch);
  currentBatch.current = batch;
  const draft = useRef<PageDraft>({});
  const [missing, setMissing] = useState(false);
  const fetchPage = useEffectEvent((id: string) => loadPage(id));
  const [activityFocus, setActivityFocus] = useState<ActivityFocus | null>(null);
  const activityFocusMode = useRef<Mode | null>(null);
  const activityFocusTimer = useRef<number | null>(null);

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
      batch.discardPending();
      void loadPage(pageId).then((p) => {
        if (!p) return;
        draft.current = {};
        setTitle(p.title);
        setContent(p.content);
        setBoard(p.board);
        setSaveState("saved");
      });
    }
    window.addEventListener("relay:history-restored", onRestored);
    return () => window.removeEventListener("relay:history-restored", onRestored);
  }, [pageId, loadPage, batch, setSaveState]);
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    draft.current = {};
    setContentPageId(null);
    setSaveState("idle");
    setMissing(false);
    void fetchPage(pageId).then((p) => {
      if (cancelled) return;
      if (!p) {
        setMissing(true);
        setSaveState("error");
        return;
      }
      setMissing(false);
      setTitle(p.title);
      setContent(p.content);
      setContentPageId(pageId);
      setBoard(p.board);
      setMode(activityFocusMode.current ?? "text");
      activityFocusMode.current = null;
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, wsMode, activeWorkspaceId, auth.token]);

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

  if (contentPageId !== pageId) {
    return <LoadingIndicator centered />;
  }

  function stageEdit(patch: PageDraft, announce = true) {
    Object.assign(draft.current, patch);
    batch.stage(patch, async ({ title, readContent, readBoard }, showStatus) => {
      if (showStatus && currentBatch.current === batch) setSaveState("saving");
      try {
        await updatePage(pageId, {
          ...(title !== undefined ? { title } : {}),
          ...(readContent ? { content: readContent() } : {}),
          ...(readBoard ? { board: readBoard() } : {}),
        });
        if (showStatus && currentBatch.current === batch) setSaveState("saved");
      } catch (error) {
        if (currentBatch.current === batch) setSaveState("error");
        throw error;
      }
    }, announce);
  }

  async function moveBlock(targetId: string, blockId: string, doc: Doc) {
    await batch.flush();
    const next = await movePageBlock(pageId, targetId, blockId, doc);
    delete draft.current.readContent;
    setContent(next);
    setSaveState("saved");
    return next;
  }

  const pageUrl =
    wsMode === "cloud" && activeWorkspaceId
      ? `${publicAppOrigin()}/w/${activeWorkspaceId}/p/${pageId}`
      : null;


  async function removePage() {
    const ok = await dialog.confirm({
      title: ta("deletePageConfirm", { title: title || tc("untitled") }),
      confirmLabel: tc("delete"),
      danger: true,
    });
    if (!ok) return;
    await deletePage(pageId);
    batch.discardPending();
    onBack();
  }

  return (
    <div className="workspace-fill">
      <header className="relay-page-header">
        <div className="relay-page-heading">
          <button type="button" className="relay-page-control" aria-label={t("backToList")} onClick={onBack}>
            <ArrowLeft aria-hidden />
          </button>
          <input
            ref={titleInput}
            className="title-input"
            value={title}
            onChange={(event) => {
              const next = event.target.value;
              setTitle(next);
              stageEdit({ title: next.trim() || tc("untitled") });
            }}
            placeholder={t("titlePlaceholder")}
            aria-label={t("titleAria")}
            readOnly={!canWrite}
          />
        </div>
        <ContentModeSwitch value={mode} onChange={setMode} boardLabel={ta("board")} textLabel={ta("text")} />
        <div className="relay-page-header-actions">
          {canWrite && <WorkspacePresence save={saveState} revision={saveRevision} />}
          <PageActions
            key={pageId}
            pageUrl={pageUrl ? pageUrl + "?mode=" + mode : null}
            onRename={canWrite ? () => { titleInput.current?.focus(); titleInput.current?.select(); } : undefined}
            onHistory={wsMode === "cloud" ? () => {
              void batch.flush().then(() => window.dispatchEvent(new CustomEvent("relay:open-page-history", { detail: pageId }))).catch(() => undefined);
            } : undefined}
            onDelete={canWrite ? () => void removePage() : undefined}
          />
        </div>
      </header>

      {mode === "text" ? (
        <OverlayScroll ref={modeMotion} arrows className="editor-card-scroll" contentClassName="card editor-card">
          <BlockEditor
            key={pageId}
            content={content}
            getDraft={() => draft.current.readContent?.()}
            resources={{pageId,saveText:nativeSaveCode,moveBlock,request:<T,>(suffix:string,init?:RequestInit)=>wsMode==='guest'?guestResourceRequest<T>(pageId,pages,suffix,init):api<T>(`/pages/${pageId}/tools${suffix}`,{...init,token:auth.token}),openPage:(id)=>window.dispatchEvent(new CustomEvent('relay:open-page',{detail:id})),createPage}}
            editable={canWrite}
            comments={{
              pageId, identity: wsMode === "guest" ? "guest" : auth.user?.id ?? "signed-out",
              request: <T,>(suffix: string, init?: RequestInit) => wsMode === "guest" ? guestCommentRequest<T>(pageId, pages, { id: "guest", name: locale === "ru" ? "Гость" : "Guest" }, suffix, init) : api<T>(`/pages/${pageId}/comments${suffix}`, { ...init, token: auth.token }),
              blockLink: (blockId, threadId) => wsMode === "cloud" ? `${publicAppOrigin()}/w/${activeWorkspaceId}/p/${pageId}?mode=text#${new URLSearchParams({ block: blockId, ...(threadId ? { comment: threadId } : {}) })}` : `${window.location.href.split("#")[0]}#${new URLSearchParams({ page: pageId, block: blockId, ...(threadId ? { comment: threadId } : {}) })}`,
              openPage: (id) => window.dispatchEvent(new CustomEvent("relay:open-page", { detail: id })),
            }}
            onChange={(readContent, { initializing }) => stageEdit({ readContent }, !initializing)}
            focusPhrases={activityFocus?.phrases}
            focusBlockType={activityFocus?.blockType}
            onActivityFocusDismiss={() => setActivityFocus(null)}
          />
        </OverlayScroll>
      ) : (
        <div ref={modeMotion} className="board-wrap">
          <InfiniteBoard
            key={`page-board-${pageId}`}
            editable={canWrite}
            initialSnapshot={board}
            getDraft={() => draft.current.readBoard?.()}
            syncRoomId={!offline ? `pg-${pageId}` : undefined}
            onChange={(readBoard) => stageEdit({ readBoard })}
            focusShapeIds={activityFocus?.shapeIds}
          />
        </div>
      )}
    </div>
  );
}
