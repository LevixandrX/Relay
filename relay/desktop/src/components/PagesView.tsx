import { useState } from "react";
import { useTranslations } from "use-intl";
import { useWorkspace } from "../lib/workspace";
import { formatRelative } from "../lib/store";
import { useAppLocale } from "../i18n/LocaleProvider";

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
  const { locale } = useAppLocale();
  const { pages, deletePage, mode, guestLimit } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const sorted = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const atLimit = mode === "guest" && pages.length >= guestLimit;

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
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => {
            setError(null);
            if (atLimit) {
              setError(t("guestLimitError"));
              onNeedAuth();
              return;
            }
            onCreate();
          }}
        >
          {t("newPageBtn")}
        </button>
      </div>
      {error && (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            {error}{" "}
            <button type="button" className="btn" onClick={onNeedAuth}>
              {tc("login")}
            </button>
          </p>
        </section>
      )}
      <section className="card">
        <div className="page-list">
          {sorted.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              {t("pagesEmpty")}
            </p>
          )}
          {sorted.map((p) => (
            <div key={p.id} className="page-row">
              <div>
                <strong>{p.title || tc("untitled")}</strong>
                <div className="muted">
                  {p.board ? `${t("typeBoard")} · ` : `${t("typeText")} · `}
                  {formatRelative(p.updatedAt, t, locale)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn" onClick={() => onOpenPage(p.id)}>
                  {tc("open")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (confirm(t("deleteConfirm", { title: p.title || tc("untitled") }))) {
                      void deletePage(p.id);
                    }
                  }}
                >
                  {tc("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
