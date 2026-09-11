import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { OverlayScroll } from "@relay-board/CompactRailScroll";
import { useWorkspace } from "../lib/workspace";
import { PageList } from "./PageList";

type Filter = "all" | "text" | "board";
type Sort = "updated" | "title";

export function PagesView({
  onOpenPage,
  onCreate,
  onNeedAuth,
}: {
  onOpenPage: (id: string) => void;
  onCreate: () => void;
  onNeedAuth: () => void;
}) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const ta = useTranslations("app");
  const { pages, deletePage, updatePage, mode, guestLimit } = useWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const atLimit = mode === "guest" && pages.length >= guestLimit;

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = pages.filter((p) => {
      if (filter === "board" && !p.board) return false;
      if (filter === "text" && p.board) return false;
      return !q || (p.title || "").toLowerCase().includes(q);
    });
    next.sort((a, b) => {
      if (sort === "title") {
        return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return next;
  }, [pages, query, filter, sort]);

  function create() {
    setError(null);
    if (atLimit) {
      setError(t("guestLimitError"));
      onNeedAuth();
      return;
    }
    onCreate();
  }

  function moveActive(delta: number) {
    if (sorted.length === 0) return;
    setActive((i) => (i + delta + sorted.length) % sorted.length);
  }

  return (
    <div className="page-frame pages-frame">
      <div className="toprow">
        <div className="page-title">
          <h1>{ta("pages")}</h1>
          {mode === "guest" && (
            <span className="quiet-status">
              {t("guestBadge", { count: pages.length, limit: guestLimit })}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-accent" onClick={create}>
          {t("newPageBtn")}
        </button>
      </div>

      {error && (
        <section className="card surface-card">
          <p className="muted" style={{ margin: 0 }}>
            {error}{" "}
            <button type="button" className="linkish" onClick={onNeedAuth}>
              {tc("login")}
            </button>
          </p>
        </section>
      )}

      <section className="card surface-card pages-shell">
        <div className="pages-toolbar">
          <label className="pages-search">
            <SearchGlyph />
            <span className="sr-only">{t("pagesSearchAria")}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  moveActive(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  moveActive(-1);
                } else if (e.key === "Enter" && sorted[active]) {
                  e.preventDefault();
                  onOpenPage(sorted[active].id);
                }
              }}
              placeholder={t("pagesSearch")}
            />
          </label>
          {pages.length > 0 && (
            <div className="pages-filters" role="tablist" aria-label={t("pagesFilterAria")}>
              {(
                [
                  ["all", t("pagesFilterAll")],
                  ["text", t("pagesFilterText")],
                  ["board", t("pagesFilterBoard")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="pages-filter"
                  role="tab"
                  aria-selected={filter === id}
                  data-active={filter === id}
                  onClick={() => {
                    setFilter(id);
                    setActive(0);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="pages-sort"
            onClick={() => setSort((s) => (s === "updated" ? "title" : "updated"))}
          >
            {sort === "updated" ? t("pagesSortUpdated") : t("pagesSortTitle")}
          </button>
          {pages.length > 0 && (
            <span className="pages-count">
              {t("pagesShown", { shown: sorted.length, total: pages.length })}
            </span>
          )}
        </div>
        <OverlayScroll contentClassName="pages-body">
          <PageList
            pages={sorted}
            activeId={sorted[active]?.id}
            onOpen={onOpenPage}
            onRename={(id, title) => void updatePage(id, { title })}
            onDelete={(id) => void deletePage(id)}
            empty={
              <div className="empty-state">
                <p className="empty-state-title">
                  {query || filter !== "all" ? t("pagesSearchEmpty") : t("pagesEmptyTitle")}
                </p>
                <p className="muted empty-state-hint">
                  {query || filter !== "all" ? t("pagesSearchEmptyHint") : t("pagesEmpty")}
                </p>
                {!query && filter === "all" && (
                  <div className="empty-state-actions">
                    <button type="button" className="btn btn-accent" onClick={create}>
                      {t("newPage")}
                    </button>
                  </div>
                )}
              </div>
            }
          />
        </OverlayScroll>
      </section>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m15.6 15.6 3.7 3.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
