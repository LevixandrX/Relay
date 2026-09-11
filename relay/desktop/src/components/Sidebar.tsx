import { useRef } from "react";
import { useTranslations } from "use-intl";
import type { ViewId } from "../App";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { ChevronIcon, NavIcon } from "./NavIcons";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useDialog } from "./DialogHost";
import { nextChrome, type ChromeMode } from "../lib/chrome";
import { shortcutHint, useModLabel } from "@relay-board/mod-key";
import { CompactRailScroll, OverlayScroll } from "@relay-board/CompactRailScroll";
import { UserAvatar } from "@relay-avatar";

export function Sidebar({
  view,
  onNavigate,
  chrome,
  onChrome,
  onSearch,
  onCreatePage,
  activePageId,
  onOpenPage,
}: {
  view: ViewId;
  onNavigate: (id: ViewId) => void;
  chrome: ChromeMode;
  onChrome: (mode: ChromeMode) => void;
  onSearch: () => void;
  onCreatePage: () => void;
  activePageId: string | null;
  onOpenPage: (id: string) => void;
}) {
  const t = useTranslations("desktop");
  const tb = useTranslations("board");
  const tc = useTranslations("common");
  const auth = useAuth();
  const ws = useWorkspace();
  const dialog = useDialog();
  const collapsed = chrome === "compact";
  const mod = useModLabel();
  const searchHint = shortcutHint(mod, "K");
  const railListRef = useRef<HTMLDivElement>(null);

  const chromeLabel: Record<ChromeMode, string> = {
    normal: tb("chromeNormal"),
    compact: tb("chromeCompact"),
    zen: tb("chromeZen"),
  };

  const primary: { id: ViewId; label: string; hint: string }[] = [
    { id: "home", label: t("navHome"), hint: t("navHomeHint") },
    { id: "board", label: t("navBoard"), hint: t("navBoardHint") },
    { id: "pages", label: t("navPages"), hint: t("navPagesHint") },
    { id: "team", label: t("navTeam"), hint: t("navTeamHint") },
    { id: "theme", label: t("navTheme"), hint: t("navThemeHint") },
  ];

  function planLabel() {
    if (!auth.subscription) return null;
    if (auth.subscription.isPro) {
      return auth.subscription.status === "trialing" ? t("planProTrial") : t("planProShort");
    }
    return t("planFreeShort");
  }

  const plan = planLabel();

  return (
    <aside className="sidebar" data-collapsed={collapsed ? "true" : "false"}>
      <div className="sidebar-brand">
        <WorkspaceSwitcher
          collapsed={collapsed}
          onInvite={() => onNavigate("team")}
        />
      </div>

      <div className="sidebar-quick">
        <button
          type="button"
          className="nav-item"
          onClick={onSearch}
          title={`${tc("search")} · ${searchHint}`}
          aria-label={tc("search")}
        >
          <span className="nav-ico">
            <SearchIcon />
          </span>
          <span className="nav-title">{tc("search")}</span>
          {!collapsed && <span className="nav-hint">{searchHint}</span>}
        </button>
      </div>

      <nav id="relay-sidebar-nav" className="sidebar-nav" aria-label={tc("menu")}>
        {primary.map((item) => (
          <NavButton key={item.id} item={item} active={view === item.id} onNavigate={onNavigate} />
        ))}
        <div className="nav-rule" aria-hidden />
      </nav>

      {collapsed ? (
        <div className="sidebar-page-rail">
          <div className="sidebar-page-rail-scroll">
            <div className="sidebar-page-rail-list" ref={railListRef}>
              {ws.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="nav-item"
                  data-active={page.id === activePageId}
                  title={page.title || tc("untitled")}
                  aria-label={page.title || tc("untitled")}
                  onClick={() => onOpenPage(page.id)}
                >
                  <span className="nav-ico" aria-hidden>
                    <span className="sidebar-page-mark">
                      {page.icon ?? (page.title || tc("untitled")).slice(0, 1).toUpperCase()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <CompactRailScroll target={railListRef} itemCount={ws.pages.length} />
          </div>
          <button
            type="button"
            className="nav-item"
            title={t("newPageShort")}
            aria-label={t("newPageShort")}
            onClick={onCreatePage}
          >
            <span className="nav-ico">
              <PlusIcon />
            </span>
          </button>
        </div>
      ) : (
        <div className="sidebar-pages">
          <div className="sidebar-pages-head">
            <span>{t("navPages")}</span>
          </div>
          <OverlayScroll contentClassName="sidebar-page-list">
            {ws.pages.length === 0 ? (
              <p className="sidebar-pages-empty">{t("pagesEmptyHint")}</p>
            ) : (
              ws.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="nav-item sidebar-page-item"
                  data-active={page.id === activePageId}
                  title={page.title || tc("untitled")}
                  onClick={() => onOpenPage(page.id)}
                >
                  <span className="sidebar-page-mark" aria-hidden>
                    {page.icon ?? (page.title || tc("untitled")).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="nav-title">{page.title || tc("untitled")}</span>
                </button>
              ))
            )}
          </OverlayScroll>
          <button
            type="button"
            className="sidebar-new-page"
            onClick={onCreatePage}
          >
            <PlusIcon />
            <span>{t("newPageShort")}</span>
          </button>
        </div>
      )}

      <div className="sidebar-tools">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => onChrome(nextChrome(chrome))}
          aria-controls="relay-sidebar-nav"
          title={tb("chromeSwitch", { mode: chromeLabel[nextChrome(chrome)] })}
          aria-label={tb("chromeSwitch", { mode: chromeLabel[nextChrome(chrome)] })}
        >
          <ChevronIcon collapsed={collapsed} />
          {!collapsed && <span>{chromeLabel[nextChrome(chrome)]}</span>}
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
              <UserAvatar
                name={auth.user.name}
                url={auth.user.avatarUrl}
                className="account-avatar"
              />
              {!collapsed && (
                <span className="account-meta">
                  <span className="account-name">{auth.user.name}</span>
                  <span className="account-sub">
                    <span className="account-email">
                      {plan ? `${plan} · ${auth.user.email}` : auth.user.email}
                    </span>
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

function NavButton({
  item,
  active,
  onNavigate,
}: {
  item: { id: ViewId; label: string; hint: string };
  active: boolean;
  onNavigate: (id: ViewId) => void;
}) {
  return (
    <button
      type="button"
      className="nav-item"
      data-active={active}
      title={item.hint}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      onClick={() => onNavigate(item.id)}
    >
      <span className="nav-ico">
        <NavIcon id={item.id} />
      </span>
      <span className="nav-title">{item.label}</span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="nav-ico-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 3.7 3.7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="nav-ico-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
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
