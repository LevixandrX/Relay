import { useTranslations } from "use-intl";
import type { PageRecord } from "../lib/store";
import { formatRelative } from "../lib/store";
import { useAppLocale } from "../i18n/LocaleProvider";
import { useDialog } from "./DialogHost";
import type { ReactNode } from "react";

export function PageList({
  pages,
  onOpen,
  onDelete,
  empty,
}: {
  pages: PageRecord[];
  onOpen: (id: string) => void;
  onDelete?: (id: string, title: string) => void;
  empty?: ReactNode;
}) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const dialog = useDialog();
  const { locale } = useAppLocale();

  if (pages.length === 0) {
    return <>{empty ?? null}</>;
  }

  return (
    <div className="doc-list" role="list">
      {pages.map((p) => {
        const title = p.title || tc("untitled");
        return (
          <div key={p.id} className="doc-row" role="listitem">
            <button type="button" className="doc-row-main" onClick={() => onOpen(p.id)}>
              <span className="doc-ico" aria-hidden>
                {p.board ? <BoardGlyph /> : <PageGlyph />}
              </span>
              <span className="doc-copy">
                <span className="doc-title">{title}</span>
                <span className="doc-meta">
                  {p.board ? t("typeBoard") : t("typeText")}
                  {" · "}
                  {formatRelative(p.updatedAt, t, locale)}
                </span>
              </span>
            </button>
            {onDelete && (
              <button
                type="button"
                className="doc-row-action"
                title={tc("delete")}
                aria-label={tc("delete")}
                onClick={(e) => {
                  e.stopPropagation();
                  void (async () => {
                    const ok = await dialog.confirm({
                      title: t("deleteConfirm", { title }),
                      confirmLabel: tc("delete"),
                      danger: true,
                    });
                    if (ok) onDelete(p.id, title);
                  })();
                }}
              >
                <TrashGlyph />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrashGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function PageGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7.2L19.5 9v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M14 3.5V9h5.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BoardGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
