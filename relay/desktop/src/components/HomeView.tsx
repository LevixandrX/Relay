import { useTranslations } from "use-intl";
import { shortcutHint, useModLabel } from "@relay-board/mod-key";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { formatRelative } from "../lib/store";
import { useAppLocale } from "../i18n/LocaleProvider";
import type { Doc, JSONContent } from "../lib/types";
import { PageList } from "./PageList";

function docExcerpt(doc: Doc | undefined, max = 180): string {
  const parts: string[] = [];
  const walk = (node?: JSONContent) => {
    if (!node) return;
    if (node.text) parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(doc as JSONContent | undefined);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function HomeView({
  onOpenBoard,
  onOpenPages,
  onOpenPage,
  onNeedAuth,
  onCreatePage,
  onSearch,
  onOpenTeam,
}: {
  onOpenBoard: () => void;
  onOpenPages: () => void;
  onOpenPage: (id: string) => void;
  onNeedAuth: () => void;
  onCreatePage: () => void;
  onSearch: () => void;
  onOpenTeam: () => void;
}) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const { pages, mode, guestLimit, offline } = useWorkspace();
  const auth = useAuth();
  const { locale } = useAppLocale();
  const mod = useModLabel();
  const searchHint = shortcutHint(mod, "K");
  const recent = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latest = recent[0];
  const latestExcerpt = latest ? docExcerpt(latest.content) : "";
  const recentList = recent.slice(0, 4);
  const state = pages.length === 0 ? "fresh" : recentList.length > 1 ? "full" : "continue";

  return (
    <div className="page-frame home-stack">
      <header className="home-head">
        <div className="toprow">
          <div className="page-title">
            <h1>{t("homeTitle")}</h1>
          </div>
          {!auth.user && (
            <div className="home-head-tools">
              <button type="button" className="btn btn-accent" onClick={onNeedAuth}>
                {t("loginCloud")}
              </button>
            </div>
          )}
        </div>
        <p className="theme-lede muted">
          {mode === "cloud" ? t("homeCloudMode") : t("homeGuestMode", { limit: guestLimit })}
          {offline ? t("homeOffline") : ""}
        </p>
      </header>

      <div className="home-body">
        <div className="home-bento" data-state={state}>
          <button type="button" className="card surface-card home-tile home-tile-board" onClick={onOpenBoard}>
            <span className="home-tile-art" aria-hidden>
              <BoardMark />
            </span>
            <span className="home-tile-copy">
              <strong className="home-tile-title">{t("openBoard")}</strong>
              <span className="home-tile-meta">{t("openBoardDesc")}</span>
            </span>
          </button>

          <button type="button" className="card surface-card home-tile home-tile-page" onClick={onCreatePage}>
            <span className="home-tile-art" aria-hidden>
              <PageMark />
            </span>
            <span className="home-tile-copy">
              <strong className="home-tile-title">{t("newPage")}</strong>
              <span className="home-tile-meta">{t("newPageDesc")}</span>
            </span>
          </button>

          {state === "fresh" ? (
            <section className="card surface-card home-tile home-tile-start home-tile-static">
              <span className="home-tile-art home-tile-art-pair" aria-hidden>
                <PageMark />
                <BoardMark />
              </span>
              <span className="home-tile-copy">
                <span className="home-tile-kicker">{t("homeStartKicker")}</span>
                <strong className="home-tile-title">{t("homeEmptyTitle")}</strong>
                <span className="home-tile-meta">{t("homeEmptyBody")}</span>
              </span>
              <span className="home-tile-start-actions">
                <button type="button" onClick={onCreatePage}>
                  {t("newPage")}
                </button>
                <button type="button" onClick={onOpenBoard}>
                  {t("openBoard")}
                </button>
              </span>
            </section>
          ) : (
            <button type="button" className="card surface-card home-tile home-tile-search" onClick={onSearch}>
              <span className="home-tile-art" aria-hidden>
                <SearchMark />
              </span>
              <span className="home-tile-copy">
                <strong className="home-tile-title">{t("homeSearchCta")}</strong>
                <span className="home-tile-meta">
                  {t("homeSearchHint", { shortcut: searchHint })}
                </span>
              </span>
            </button>
          )}

          {auth.user ? (
            <button type="button" className="card surface-card home-tile home-tile-extra" onClick={onOpenTeam}>
              <span className="home-tile-art" aria-hidden>
                <TeamMark />
              </span>
              <span className="home-tile-copy">
                <strong className="home-tile-title">{t("homeTeamCta")}</strong>
                <span className="home-tile-meta">{t("homeTeamDesc")}</span>
              </span>
            </button>
          ) : (
            <button type="button" className="card surface-card home-tile home-tile-extra" onClick={onNeedAuth}>
              <span className="home-tile-art" aria-hidden>
                <CloudMark />
              </span>
              <span className="home-tile-copy">
                <strong className="home-tile-title">{t("homeCloudTile")}</strong>
                <span className="home-tile-meta">{t("homeCloudTileDesc")}</span>
              </span>
            </button>
          )}

          {latest && (
            <button
              type="button"
              className="card surface-card home-tile home-tile-continue"
              onClick={() => onOpenPage(latest.id)}
            >
              <span className="home-tile-art" aria-hidden>
                {latest.board ? <BoardMark /> : <PageMark />}
              </span>
              <span className="home-tile-copy">
                <span className="home-tile-kicker">{t("homeContinue")}</span>
                <strong className="home-tile-title">{latest.title || tc("untitled")}</strong>
                <span className="home-tile-meta">
                  {latest.board ? t("typeBoard") : t("typeText")}
                  {" · "}
                  {formatRelative(latest.updatedAt, t, locale)}
                </span>
                {latestExcerpt ? <span className="home-tile-excerpt">{latestExcerpt}</span> : null}
              </span>
              <span className="home-tile-cue">{t("homeContinueOpen")}</span>
            </button>
          )}

          {recentList.length > 1 && (
            <section
              className="card surface-card home-tile home-tile-recent home-tile-static"
              data-count={recentList.length}
            >
              <div className="card-head">
                <h2>{t("recentTitle")}</h2>
                <button type="button" className="home-all" onClick={onOpenPages}>
                  {tc("all")}
                  <span>{pages.length}</span>
                </button>
              </div>
              <div className="home-recent-list">
                <PageList pages={recentList} onOpen={onOpenPage} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function PageMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7.2L19.5 9v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M14 3.5V9h5.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function BoardMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function SearchMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="m15.2 15.2 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TeamMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16.2" cy="9.2" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.6 18.2c.6-2.8 2.6-4.4 4.4-4.4s3.8 1.6 4.4 4.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13.4 16.4c.5-1.8 1.8-2.8 3-2.8 1.3 0 2.6 1 3.1 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CloudMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.2 17.5h9.4a3.4 3.4 0 0 0 .4-6.8 4.6 4.6 0 0 0-8.7-1.3A3.2 3.2 0 0 0 7.2 17.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
