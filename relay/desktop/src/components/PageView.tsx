import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { BlockEditor } from "../editor/BlockEditor";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { useWorkspace } from "../lib/workspace";
import { emptyDoc, type BoardSnapshot, type Doc } from "../lib/types";

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
  const { loadPage, updatePage, offline } = useWorkspace();
  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Doc>(emptyDoc());
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "loading" | "error">(
    "loading",
  );
  const [missing, setMissing] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setMode("text");
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
          <span className="badge">
            <span className="dot" />
            {offline
              ? t("statusOffline")
              : saveState === "saving"
                ? t("statusSaving")
                : saveState === "error"
                  ? t("statusError")
                  : tc("save")}
          </span>
        </div>
        <div className="tabs">
          <button
            type="button"
            className="tab"
            data-active={mode === "text"}
            onClick={() => setMode("text")}
          >
            {ta("text")}
          </button>
          <button
            type="button"
            className="tab"
            data-active={mode === "board"}
            onClick={() => setMode("board")}
          >
            {ta("board")}
          </button>
        </div>
      </div>

      {mode === "text" ? (
        <section className="card editor-card">
          <BlockEditor content={content} onChange={scheduleContent} />
        </section>
      ) : (
        <div className="board-wrap">
          <InfiniteBoard
            key={`page-board-${pageId}`}
            initialSnapshot={board}
            onChange={onBoardChange}
          />
        </div>
      )}
    </div>
  );
}
