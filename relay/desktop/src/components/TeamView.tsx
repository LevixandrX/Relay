import { useState } from "react";
import { useTranslations } from "use-intl";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { ApiClientError } from "../lib/api";

export function TeamView() {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const ta = useTranslations("app");
  const auth = useAuth();
  const ws = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [msg, setMsg] = useState<string | null>(null);

  if (ws.mode === "guest") {
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{t("teamTitle")}</h2>
        <p className="muted">{t("teamGuestLede")}</p>
      </section>
    );
  }

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>{t("teamTitle")}</h1>
          {auth.subscription && (
            <span className="badge">
              {t("membersLimit", {
                plan: auth.subscription.isPro ? t("planProShort") : t("planFreeShort"),
                limit: auth.subscription.limits.membersPerWorkspace,
              })}
            </span>
          )}
        </div>
        <button type="button" className="btn" onClick={() => void ws.refreshMembers()}>
          {tc("refresh")}
        </button>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>{t("members")}</h2>
        <div className="page-list">
          {ws.members.map((m) => (
            <div key={m.id} className="page-row">
              <div>
                <strong>{m.name}</strong>
                <div className="muted">
                  {m.email} · {m.role}
                </div>
              </div>
            </div>
          ))}
          {ws.members.length === 0 && <p className="muted">{t("membersEmpty")}</p>}
        </div>
      </section>

      {ws.activeRole === "owner" && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{t("invite")}</h2>
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              setMsg(null);
              void ws
                .inviteMember(email, role)
                .then((r) => {
                  setMsg(
                    r.acceptToken
                      ? t("inviteLink", { token: r.acceptToken })
                      : tc("done"),
                  );
                  setEmail("");
                  void ws.refreshMembers();
                })
                .catch((err) => {
                  setMsg(err instanceof ApiClientError ? err.message : tc("error"));
                });
            }}
          >
            <label className="field">
              <span>{tc("email")}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("role")}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
              >
                <option value="editor">{t("roleEditor")}</option>
                <option value="viewer">{t("roleViewer")}</option>
              </select>
            </label>
            <button type="submit" className="btn btn-accent">
              {ta("invite")}
            </button>
            {msg && <p className="muted">{msg}</p>}
          </form>
        </section>
      )}
    </>
  );
}
