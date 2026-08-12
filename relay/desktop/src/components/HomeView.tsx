import { useTranslations } from "use-intl";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { formatRelative } from "../lib/store";
import { useAppLocale } from "../i18n/LocaleProvider";

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
  const tc = useTranslations("common");
  const { locale } = useAppLocale();
  const { pages, mode, guestLimit, offline } = useWorkspace();
  const auth = useAuth();
  const recent = [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const empty = pages.length === 0;

  function planLabel() {
    if (!auth.subscription) return null;
    if (auth.subscription.isPro) {
      return auth.subscription.status === "trialing" ? t("planProTrial") : t("planPro");
    }
    return t("planFree");
  }

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>{t("homeTitle")}</h1>
          <p className="muted" style={{ margin: "0.2rem 0 0" }}>
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

      <section className="start-grid">
        <button type="button" className="start-tile" onClick={onOpenBoard}>
          <span className="start-kicker">{t("kickMain")}</span>
          <strong>{t("openBoard")}</strong>
          <span className="muted">{t("openBoardDesc")}</span>
        </button>
        <button type="button" className="start-tile" onClick={onCreatePage}>
          <span className="start-kicker">{t("kickText")}</span>
          <strong>{t("newPage")}</strong>
          <span className="muted">{t("newPageDesc")}</span>
        </button>
        <button type="button" className="start-tile" onClick={onOpenPages}>
          <span className="start-kicker">{t("kickList")}</span>
          <strong>{t("allPages")}</strong>
          <span className="muted">
            {pages.length
              ? t("pagesCount", { count: pages.length })
              : t("pagesEmptyHint")}
          </span>
        </button>
        {!auth.user ? (
          <button type="button" className="start-tile" onClick={onNeedAuth}>
            <span className="start-kicker">{t("kickCloud")}</span>
            <strong>{t("authCta")}</strong>
            <span className="muted">{t("authCtaDesc")}</span>
          </button>
        ) : (
          <div className="start-tile start-tile-static">
            <span className="start-kicker">{t("kickAccount")}</span>
            <strong>{auth.user.name}</strong>
            <span className="muted">
              {planLabel()}
              {" · "}
              {auth.user.email}
            </span>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>{empty ? t("nextTitle") : t("recentTitle")}</h2>
          {!empty && (
            <button type="button" className="btn" onClick={onOpenPages}>
              {tc("all")}
            </button>
          )}
        </div>
        {empty ? (
          <ol className="howto">
            <li>{t("howto1")}</li>
            <li>{t("howto2")}</li>
            <li>{t("howto3")}</li>
          </ol>
        ) : (
          <div className="page-list">
            {recent.map((p) => (
              <div key={p.id} className="page-row">
                <div>
                  <strong>{p.title || tc("untitled")}</strong>
                  <div className="muted">{formatRelative(p.updatedAt, t, locale)}</div>
                </div>
                <button type="button" className="btn" onClick={() => onOpenPage(p.id)}>
                  {tc("open")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
