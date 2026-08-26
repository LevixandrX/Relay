import { useTranslations } from "use-intl";
import { labelPulseAction, useWorkspacePulse } from "../lib/useWorkspacePulse";

export function PulseStrip({
  collapsed,
  onExpand,
}: {
  collapsed: boolean;
  onExpand?: () => void;
}) {
  const t = useTranslations("desktop");
  const ta = useTranslations("app");
  const tc = useTranslations("common");
  const { pulse, isCloud } = useWorkspacePulse();

  if (!isCloud) return null;

  const latest = pulse[0];
  const collapsedTip = latest
    ? `${latest.actorName ?? tc("someone")} ${labelPulseAction(latest.action, ta)}`
    : t("pulseEmpty");

  if (collapsed) {
    return (
      <button
        type="button"
        className="nav-item sidebar-pulse-rail"
        title={collapsedTip}
        aria-label={t("pulse")}
        onClick={() => onExpand?.()}
      >
        <span className="nav-ico sidebar-pulse-rail-ico">
          <PulseIcon />
          {pulse.length > 0 && (
            <span className="sidebar-pulse-badge" aria-hidden>
              {pulse.length > 9 ? "9+" : pulse.length}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <section className="sidebar-pulse" aria-label={t("pulse")}>
      <div className="nav-label">{t("pulse")}</div>
      {pulse.length === 0 ? (
        <p className="sidebar-pulse-empty">{t("pulseEmpty")}</p>
      ) : (
        <ul className="sidebar-pulse-list">
          {pulse.slice(0, 4).map((ev) => (
            <li key={ev.id} className="sidebar-pulse-item">
              <strong>{ev.actorName ?? tc("someone")}</strong> {labelPulseAction(ev.action, ta)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PulseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="nav-ico-svg">
      <path
        d="M4 12h2.2l1.4-3.5 2.8 7 1.6-4 1.4 3.5H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
