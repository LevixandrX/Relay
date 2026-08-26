import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import type { ViewId } from "../App";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { ChevronIcon, NavIcon } from "./NavIcons";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { PulseStrip } from "./PulseStrip";
import { useDialog } from "./DialogHost";

const COLLAPSE_KEY = "relay.desktop.sidebarCollapsed";

export function Sidebar({
  view,
  onNavigate,
}: {
  view: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const auth = useAuth();
  const ws = useWorkspace();
  const dialog = useDialog();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function setCollapsedPersist(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const items: { id: ViewId; label: string; hint: string }[] = [
    { id: "home", label: t("navHome"), hint: t("navHomeHint") },
    { id: "board", label: t("navBoard"), hint: t("navBoardHint") },
    { id: "pages", label: t("navPages"), hint: t("navPagesHint") },
    { id: "team", label: t("navTeam"), hint: t("navTeamHint") },
    { id: "theme", label: t("navTheme"), hint: t("navThemeHint") },
    { id: "auth", label: t("navAuth"), hint: t("navAuthHint") },
  ];

  function planLabel() {
    if (!auth.subscription) return null;
    if (auth.subscription.isPro) {
      return auth.subscription.status === "trialing" ? t("planProTrial") : t("planProShort");
    }
    return t("planFreeShort");
  }

  const initials = (auth.user?.name || "?").slice(0, 1).toUpperCase();
  const plan = planLabel();

  return (
    <aside className="sidebar" data-collapsed={collapsed ? "true" : "false"}>
      <div className="sidebar-brand">
        <WorkspaceSwitcher
          collapsed={collapsed}
          onExpand={() => setCollapsedPersist(false)}
          onInvite={() => onNavigate("team")}
        />
      </div>

      {!collapsed && <div className="nav-label">{tc("menu")}</div>}

      <nav id="relay-sidebar-nav" className="sidebar-nav" aria-label={tc("menu")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="nav-item"
            data-active={view === item.id}
            title={collapsed ? `${item.label} — ${item.hint}` : item.hint}
            aria-current={view === item.id ? "page" : undefined}
            aria-label={item.label}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-ico">
              <NavIcon id={item.id} />
            </span>
            <span className="nav-copy">
              <span className="nav-title">{item.label}</span>
              <span className="nav-hint">{item.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      <PulseStrip collapsed={collapsed} onExpand={() => setCollapsedPersist(false)} />

      <div className="sidebar-spacer" />

      <div className="sidebar-tools">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsedPersist(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="relay-sidebar-nav"
          title={collapsed ? t("sidebarExpand") : t("sidebarCollapse")}
          aria-label={collapsed ? t("sidebarExpand") : t("sidebarCollapse")}
        >
          <ChevronIcon collapsed={collapsed} />
          {!collapsed && <span>{t("sidebarCollapse")}</span>}
        </button>
      </div>

      <div className="sidebar-foot">
        {auth.user ? (
          <div
            className="account-chip"
            title={collapsed ? `${auth.user.name} · ${auth.user.email}` : undefined}
          >
            <button
              type="button"
              className="account-chip-main"
              onClick={() => onNavigate("auth")}
              aria-label={auth.user.name}
            >
              <span className="account-avatar" aria-hidden>
                {initials}
              </span>
              {!collapsed && (
                <span className="account-meta">
                  <span className="account-name">{auth.user.name}</span>
                  <span className="account-sub">
                    {plan ? <span className="account-plan">{plan}</span> : null}
                    <span className="account-email">{auth.user.email}</span>
                  </span>
                </span>
              )}
            </button>
            {!collapsed && (
              <button
                type="button"
                className="account-logout"
                onClick={() => {
                  void (async () => {
                    const ok = await dialog.confirm({
                      title: tc("logoutConfirm"),
                      confirmLabel: tc("logout"),
                    });
                    if (ok) await auth.logout();
                  })();
                }}
                title={tc("logout")}
                aria-label={tc("logout")}
              >
                <LogoutIcon />
              </button>
            )}
          </div>
        ) : collapsed ? (
          <button
            type="button"
            className="account-avatar account-avatar-guest"
            onClick={() => onNavigate("auth")}
            title={tc("login")}
            aria-label={tc("login")}
          >
            ?
          </button>
        ) : (
          <div className="guest-chip">
            <div className="guest-chip-copy">
              <strong>{t("guestChipTitle")}</strong>
              <span className="muted">{t("guestFooter", { limit: ws.guestLimit })}</span>
            </div>
            <button type="button" className="btn btn-accent guest-chip-cta" onClick={() => onNavigate("auth")}>
              {tc("login")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11A2 2 0 0 0 6.5 19.5H10"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M10.5 12H19.5M16.5 8.5 20 12l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
