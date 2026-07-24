import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { ApiClientError } from "../lib/api";

export function TeamView() {
  const auth = useAuth();
  const ws = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [msg, setMsg] = useState<string | null>(null);

  if (ws.mode === "guest") {
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Команда</h2>
        <p className="muted">
          Войди в аккаунт, чтобы приглашать коллег в пространство и видеть участников.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>Команда</h1>
          {auth.subscription && (
            <span className="badge">
              {auth.subscription.isPro ? "Pro" : "Free"} · до{" "}
              {auth.subscription.limits.membersPerWorkspace} уч.
            </span>
          )}
        </div>
        <button type="button" className="btn" onClick={() => void ws.refreshMembers()}>
          Обновить
        </button>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Участники</h2>
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
          {ws.members.length === 0 && <p className="muted">Пока только ты.</p>}
        </div>
      </section>

      {ws.activeRole === "owner" && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Пригласить</h2>
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              setMsg(null);
              void ws
                .inviteMember(email, role)
                .then((r) => {
                  setMsg(
                    r.autoAccepted
                      ? "Уже в аккаунте — добавлен сразу."
                      : r.acceptToken
                        ? `Ссылка: /invite/${r.acceptToken}`
                        : "Готово",
                  );
                  setEmail("");
                  void ws.refreshMembers();
                })
                .catch((err) => {
                  setMsg(err instanceof ApiClientError ? err.message : "Ошибка");
                });
            }}
          >
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Роль</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
              >
                <option value="editor">Редактор</option>
                <option value="viewer">Наблюдатель</option>
              </select>
            </label>
            <button type="submit" className="btn btn-accent">
              Пригласить
            </button>
            {msg && <p className="muted">{msg}</p>}
          </form>
        </section>
      )}
    </>
  );
}
