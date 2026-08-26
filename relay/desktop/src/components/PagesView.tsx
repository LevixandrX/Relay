import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { useWorkspace } from "../lib/workspace";
import { PageList } from "./PageList";

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
  const { pages, deletePage, mode, guestLimit } = useWorkspace();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const atLimit = mode === "guest" && pages.length >= guestLimit;

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...pages]
      .filter((p) => !q || (p.title || "").toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pages, query]);

  function create() {
    setError(null);
    if (atLimit) {
      setError(t("guestLimitError"));
      onNeedAuth();
      return;
    }
    onCreate();
  }

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>{ta("pages")}</h1>
          {mode === "guest" && (
            <span className="badge">
              {t("guestBadge", { count: pages.length, limit: guestLimit })}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-accent" onClick={create}>
          {t("newPageBtn")}
        </button>
      </div>

      {pages.length > 0 && (
        <label className="search-field">
          <span className="sr-only">{t("pagesSearchAria")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pagesSearch")}
          />
        </label>
      )}

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

      <section className="card surface-card">
        <PageList
          pages={sorted}
          onOpen={onOpenPage}
          onDelete={(id) => void deletePage(id)}
          empty={
            <div className="empty-state">
              <p className="empty-state-title">
                {query ? t("pagesSearchEmpty") : t("pagesEmptyTitle")}
              </p>
              <p className="muted empty-state-hint">
                {query ? t("pagesSearchEmptyHint") : t("pagesEmpty")}
              </p>
              {!query && (
                <div className="empty-state-actions">
                  <button type="button" className="btn btn-accent" onClick={create}>
                    {t("newPage")}
                  </button>
                </div>
              )}
            </div>
          }
        />
      </section>
    </>
  );
}
