import { useState } from "react";
import { useTranslations } from "use-intl";
import type { ViewId } from "../App";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { ApiClientError } from "../lib/api";

export function Sidebar({
  view,
  onNavigate,
}: {
  view: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const ta = useTranslations("app");
  const auth = useAuth();
  const ws = useWorkspace();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

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

  return (
    <aside className="sidebar">
      <div className="nav-label">{tc("menu")}</div>
      {ws.mode === "cloud" && auth.workspaces.length > 0 && (
        <select
          className="ws-select"
          value={ws.activeWorkspaceId ?? ""}
          onChange={(e) => ws.setActiveWorkspace(e.target.value)}
          aria-label={t("workspaceAria")}
        >
          {auth.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.role}
            </option>
          ))}
        </select>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="nav-item"
          data-active={view === item.id}
          title={item.hint}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-copy">
            <span className="nav-title">{item.label}</span>
            <span className="nav-hint">{item.hint}</span>
          </span>
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {auth.user ? (
        <div className="account-card">
          <strong>{auth.user.name}</strong>
          <div className="muted" style={{ fontSize: "0.75rem" }}>
            {auth.user.email}
          </div>
          {auth.subscription && (
            <div className="muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
              {planLabel()}
            </div>
          )}
          <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => void auth.logout()}>
            {tc("logout")}
          </button>
        </div>
      ) : (
        <p className="footer-note">
          {t("guestFooter", { limit: ws.guestLimit })}{" "}
          <button type="button" className="linkish" onClick={() => onNavigate("auth")}>
            {tc("login")}
          </button>
        </p>
      )}

      {view === "team" && ws.mode === "cloud" && (
        <div className="team-mini">
          <div className="nav-label">{t("members")}</div>
          {ws.members.map((m) => (
            <div key={m.id} className="muted" style={{ fontSize: "0.78rem", padding: "0.2rem 0.45rem" }}>
              {m.name} · {m.role}
            </div>
          ))}
          {ws.activeRole === "owner" && (
            <form
              style={{ padding: "0.45rem", display: "grid", gap: 6 }}
              onSubmit={(e) => {
                e.preventDefault();
                setInviteMsg(null);
                void ws
                  .inviteMember(inviteEmail, "editor")
                  .then((r) => {
                    setInviteMsg(
                      r.acceptToken ? t("inviteToken", { token: r.acceptToken }) : t("inviteSent"),
                    );
                    setInviteEmail("");
                    void ws.refreshMembers();
                  })
                  .catch((err) => {
                    setInviteMsg(err instanceof ApiClientError ? err.message : tc("error"));
                  });
              }}
            >
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@"
                type="email"
                required
                style={{ width: "100%" }}
              />
              <button type="submit" className="btn btn-accent">
                {ta("invite")}
              </button>
              {inviteMsg && <p className="muted" style={{ fontSize: "0.72rem", margin: 0 }}>{inviteMsg}</p>}
            </form>
          )}
        </div>
      )}
    </aside>
  );
}
