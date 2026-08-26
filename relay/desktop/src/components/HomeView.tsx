import { useTranslations } from "use-intl";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { PageList } from "./PageList";
import { labelPulseAction, useWorkspacePulse } from "../lib/useWorkspacePulse";

export function HomeView({
  onOpenBoard,
  onOpenPages,
  onOpenPage,
  onNeedAuth,
  onCreatePage,
}: {
  onOpenBoard: () => void;
  onOpenPages: () => void;
  onOpenPage: (id: string) => void;
  onNeedAuth: () => void;
  onCreatePage: () => void;
}) {
  const t = useTranslations("desktop");
  const ta = useTranslations("app");
  const tc = useTranslations("common");
  const { pages, mode, guestLimit, offline } = useWorkspace();
  const auth = useAuth();
  const { pulse, isCloud } = useWorkspacePulse();
  const recent = [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  const empty = pages.length === 0;

  return (
    <div className="home-stack">
      <div className="home-stack-main">
        <div className="toprow">
          <div className="page-title">
            <h1>{t("homeTitle")}</h1>
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              {mode === "cloud"
                ? t("homeCloudMode")
                : t("homeGuestMode", { limit: guestLimit })}
              {offline ? t("homeOffline") : ""}
            </p>
          </div>
          {!auth.user && (
            <button type="button" className="btn btn-accent" onClick={onNeedAuth}>
              {t("loginCloud")}
            </button>
          )}
        </div>

        <section className="launch-grid" aria-label={t("homeTitle")}>
          <button type="button" className="launch-card launch-card-primary" onClick={onOpenBoard}>
            <span className="launch-ico" aria-hidden>
              <BoardIcon />
            </span>
            <span className="launch-copy">
              <strong>{t("openBoard")}</strong>
              <span className="muted">{t("openBoardDesc")}</span>
            </span>
            <span className="launch-go" aria-hidden>
              →
            </span>
          </button>
          <button type="button" className="launch-card" onClick={onCreatePage}>
            <span className="launch-ico" aria-hidden>
              <PageIcon />
            </span>
            <span className="launch-copy">
              <strong>{t("newPage")}</strong>
              <span className="muted">{t("newPageDesc")}</span>
            </span>
            <span className="launch-go" aria-hidden>
              →
            </span>
          </button>
        </section>

        <section className="card surface-card">
          <div className="card-head">
            <h2 style={{ margin: 0 }}>{empty ? t("homeEmptyTitle") : t("recentTitle")}</h2>
            {!empty && (
              <button type="button" className="btn" onClick={onOpenPages}>
                {tc("all")}
              </button>
            )}
          </div>

          {empty ? (
            <div className="empty-state">
              <p className="empty-state-title">{t("homeEmptyBody")}</p>
              <p className="muted empty-state-hint">{t("homeEmptyHint")}</p>
              <div className="empty-state-actions">
                <button type="button" className="btn btn-accent" onClick={onCreatePage}>
                  {t("newPage")}
                </button>
                <button type="button" className="btn" onClick={onOpenBoard}>
                  {t("openBoard")}
                </button>
              </div>
            </div>
          ) : (
            <PageList pages={recent} onOpen={onOpenPage} />
          )}
        </section>
      </div>

      {isCloud && (
        <section className="card surface-card home-pulse-footer" aria-label={t("pulse")}>
          <div className="card-head">
            <div>
              <h2 style={{ margin: 0, fontSize: "0.92rem" }}>{t("pulse")}</h2>
              <p className="muted" style={{ margin: "0.15rem 0 0", fontSize: "0.74rem" }}>
                {t("pulseHint")}
              </p>
            </div>
          </div>
          {pulse.length === 0 ? (
            <p className="muted home-pulse-empty">{t("pulseEmpty")}</p>
          ) : (
            <ul className="pulse-list">
              {pulse.slice(0, 5).map((ev) => (
                <li key={ev.id} className="pulse-item">
                  <strong>{ev.actorName ?? tc("someone")}</strong> {labelPulseAction(ev.action, ta)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function BoardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7.2L19.5 9v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 3.5V9h5.5M9 13h6M9 16.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
