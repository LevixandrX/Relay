import { useState } from "react";
import { useAuth } from "../lib/auth";
import { ApiClientError } from "../lib/api";

export function AuthView({ onDone }: { onDone: () => void }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [tokenPaste, setTokenPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await auth.login(email, password);
      else await auth.register({ email, password, name: name || email.split("@")[0] });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>{mode === "login" ? "Вход в облако" : "Регистрация"}</h1>
        </div>
        <div className="tabs">
          <button
            type="button"
            className="tab"
            data-active={mode === "login"}
            onClick={() => setMode("login")}
          >
            Вход
          </button>
          <button
            type="button"
            className="tab"
            data-active={mode === "register"}
            onClick={() => setMode("register")}
          >
            Аккаунт
          </button>
        </div>
      </div>

      <section className="card theme-panel">
        <form onSubmit={(e) => void submit(e)} className="auth-form">
          {mode === "register" && (
            <label className="field">
              <span>Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && <p className="muted" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <div>
          <h2 style={{ margin: "0 0 0.55rem" }}>Или через провайдера</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => auth.openOAuth("google")}>
              Google
            </button>
            <button type="button" className="btn" onClick={() => auth.openOAuth("github")}>
              GitHub
            </button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            После OAuth браузер откроет deep link. Если не сработал — вставь токен из URL
            (`?token=…`) ниже.
          </p>
          <div className="custom-row" style={{ marginTop: 8 }}>
            <input
              value={tokenPaste}
              onChange={(e) => setTokenPaste(e.target.value)}
              placeholder="accessToken"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!tokenPaste.trim()) return;
                void auth.setToken(tokenPaste.trim()).then(onDone);
              }}
            >
              Применить
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
