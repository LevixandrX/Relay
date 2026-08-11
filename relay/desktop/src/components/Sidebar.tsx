import { useState } from "react";
import type { ViewId } from "../App";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { ApiClientError } from "../lib/api";

function navItems(loggedIn: boolean): { id: ViewId; label: string; hint: string }[] {
  return [
    { id: "home", label: "Старт", hint: "Что делать дальше" },
    { id: "board", label: "Холст", hint: "Доска пространства" },
    { id: "pages", label: "Страницы", hint: "Текст и заметки" },
    { id: "team", label: "Команда", hint: "Участники" },
    { id: "theme", label: "Тема", hint: "Светлая / тёмная" },
    loggedIn
      ? { id: "auth", label: "Аккаунт", hint: "Профиль и выход" }
      : { id: "auth", label: "Вход", hint: "Войти или регистрация" },
  ];
}

export function Sidebar({
  view,
  onNavigate,
}: {
  view: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  const auth = useAuth();
  const ws = useWorkspace();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const items = navItems(!!auth.user);

  return (
    <aside className="sidebar">
      <div className="nav-label">Меню</div>
      {ws.mode === "cloud" && auth.workspaces.length > 0 && (
        <select
          className="ws-select"
          value={ws.activeWorkspaceId ?? ""}
          onChange={(e) => ws.setActiveWorkspace(e.target.value)}
          aria-label="Пространство"
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
              {auth.subscription.isPro
                ? auth.subscription.status === "trialing"
                  ? "Pro · пробный период"
                  : "Pro"
                : "Free"}
            </div>
          )}
          <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => void auth.logout()}>
            Выйти
          </button>
        </div>
      ) : (
        <p className="footer-note">
          Гость · до {ws.guestLimit} стр.{" "}
          <button type="button" className="linkish" onClick={() => onNavigate("auth")}>
            Войти
          </button>
        </p>
      )}

      {view === "team" && ws.mode === "cloud" && (
        <div className="team-mini">
          <div className="nav-label">Участники</div>
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
                    setInviteMsg(r.acceptToken ? `Токен: ${r.acceptToken}` : "Отправлено");
                    setInviteEmail("");
                    void ws.refreshMembers();
                  })
                  .catch((err) => {
                    setInviteMsg(err instanceof ApiClientError ? err.message : "Ошибка");
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
                Пригласить
              </button>
              {inviteMsg && <p className="muted" style={{ fontSize: "0.72rem", margin: 0 }}>{inviteMsg}</p>}
            </form>
          )}
        </div>
      )}
    </aside>
  );
}
