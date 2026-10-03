import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "use-intl";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { ApiClientError } from "../lib/api";
import { publicAppOrigin } from "../lib/app-origin";
import { OverlayScroll } from "@relay-board/CompactRailScroll";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function roleLabelKey(role: string) {
  if (role === "owner") return "roleOwner" as const;
  if (role === "editor") return "roleEditor" as const;
  return "roleViewer" as const;
}

export function TeamView({ onNeedAuth }: { onNeedAuth?: () => void }) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const auth = useAuth();
  const ws = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sortedMembers = useMemo(
    () =>
      [...ws.members].sort((a, b) => {
        const rank = (r: string) => (r === "owner" ? 0 : r === "editor" ? 1 : 2);
        const d = rank(a.role) - rank(b.role);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      }),
    [ws.members],
  );

  const limit = auth.subscription?.limits.membersPerWorkspace;
  const plan = auth.subscription?.isPro ? t("planProShort") : t("planFreeShort");
  const canInvite = ws.activeRole === "owner";
  const wsName = auth.workspaces.find((w) => w.id === ws.activeWorkspaceId)?.name ?? "Relay";

  if (ws.mode === "guest") {
    return (
      <OverlayScroll arrows className="page-frame-scroll" contentClassName="page-frame">
      <section className="card surface-card">
        <div className="empty-state">
          <p className="empty-state-title">{t("teamGuestTitle")}</p>
          <p className="muted empty-state-hint">{t("teamGuestLede")}</p>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-accent" onClick={() => onNeedAuth?.()}>
              {t("loginCloud")}
            </button>
          </div>
        </div>
      </section>
      </OverlayScroll>
    );
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    setInviteEmail(null);
    setCopied(false);
    setBusy(true);
    const targetEmail = email.trim().toLowerCase();
    try {
      const r = await ws.inviteMember(targetEmail, role);
      const url = `${publicAppOrigin()}/invite/${r.acceptToken}`;
      setInviteUrl(url);
      setInviteEmail(targetEmail);
      setEmail("");
      await ws.refreshMembers();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : tc("error"));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function mailLink() {
    if (!inviteUrl || !inviteEmail) return "#";
    const subject = encodeURIComponent(t("inviteMailSubject", { workspace: wsName }));
    const body = encodeURIComponent(t("inviteMailBody", { workspace: wsName, url: inviteUrl }));
    return `mailto:${inviteEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <OverlayScroll arrows className="page-frame-scroll" contentClassName="page-frame">
      <div className="toprow">
        <div className="page-title">
          <h1>{t("teamTitle")}</h1>
          {limit != null && (
            <span className="quiet-status">{t("membersLimit", { plan, limit })}</span>
          )}
        </div>
      </div>
      <p className="theme-lede muted">{t("teamLede")}</p>

      <section className="card surface-card team-section">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>{t("members")}</h2>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            {t("membersCount", { count: sortedMembers.length })}
          </span>
        </div>

        {sortedMembers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("membersEmpty")}
          </p>
        ) : (
          <div className="people-list">
            {sortedMembers.map((m) => (
              <div key={m.id} className="person-row">
                <span className="person-avatar" aria-hidden>
                  {initials(m.name)}
                </span>
                <span className="person-copy">
                  <span className="person-name">
                    {m.name}
                    {auth.user?.id === m.userId ? (
                      <span className="person-you">{t("memberYou")}</span>
                    ) : null}
                  </span>
                  <span className="person-email">{m.email}</span>
                </span>
                <span className="person-role" data-role={m.role}>
                  {t(roleLabelKey(m.role))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {canInvite ? (
        <section className="card surface-card team-section">
          <header className="team-invite-head">
            <h2>{t("inviteTitle")}</h2>
            <p className="muted">{t("inviteNoEmailNote")}</p>
          </header>

          <form className="invite-form" onSubmit={(e) => void invite(e)}>
            <label className="field">
              <span>{tc("email")}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </label>

            <div className="role-pills" role="radiogroup" aria-label={t("role")}>
              {(
                [
                  ["editor", t("roleEditor"), t("roleEditorHint")],
                  ["viewer", t("roleViewer"), t("roleViewerHint")],
                ] as const
              ).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  className="role-pill"
                  role="radio"
                  aria-checked={role === id}
                  data-active={role === id}
                  onClick={() => setRole(id)}
                >
                  <strong>{label}</strong>
                  <span className="muted">{hint}</span>
                </button>
              ))}
            </div>

            <button type="submit" className="btn btn-accent" disabled={busy}>
              {busy ? t("inviteSending") : t("inviteSend")}
            </button>
          </form>

          {error && <p className="form-error">{error}</p>}

          {inviteUrl && (
            <div className="invite-result">
              <p className="invite-result-title">{t("inviteReady")}</p>
              <p className="muted">{t("inviteReadyHint")}</p>
              <div className="invite-link-row">
                <code className="invite-link">{inviteUrl}</code>
                <button type="button" className="btn" onClick={() => void copyLink()}>
                  {copied ? t("inviteCopied") : t("inviteCopy")}
                </button>
                <a className="btn" href={mailLink()}>
                  {t("inviteOpenMail")}
                </a>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="card surface-card">
          <p className="muted" style={{ margin: 0 }}>
            {t("inviteOwnerOnly")}
          </p>
        </section>
      )}
    </OverlayScroll>
  );
}
