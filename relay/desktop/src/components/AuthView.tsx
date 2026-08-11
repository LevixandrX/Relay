import { useState } from "react";
import { useAuth } from "../lib/auth";
import { ApiClientError, type OAuthProvider } from "../lib/api";
import { GithubMark, GoogleMark, Spinner, YandexMark } from "./ProviderMarks";
import { openExternal } from "../lib/open-external";

/** VK ID requires business/INN verification — kept out of UI until that exists. */
const PROVIDERS: {
  id: Exclude<OAuthProvider, "vk">;
  label: string;
  mark: (props: { size?: number }) => React.ReactElement;
}[] = [
  { id: "google", label: "Google", mark: GoogleMark },
  { id: "github", label: "GitHub", mark: GithubMark },
  { id: "yandex", label: "Яндекс", mark: YandexMark },
];

export function AuthView({ onDone }: { onDone: () => void }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flow = auth.oauthFlow;
  const loggedIn = !!auth.user;

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

  async function provider(id: OAuthProvider) {
    setError(null);
    try {
      if (await auth.signInWithProvider(id)) onDone();
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "Не удалось войти через провайдера",
      );
    }
  }

  if (loggedIn) {
    return (
      <div className="auth-shell">
        <section className="auth-panel">
          <div className="auth-panel-head">
            <h1>Аккаунт</h1>
            <p className="muted">Облако подключено — можно выйти или сменить пространство слева.</p>
          </div>
          <div className="auth-account">
            <strong>{auth.user!.name}</strong>
            <span className="muted">{auth.user!.email}</span>
            {auth.subscription && (
              <span className="auth-plan">
                {auth.subscription.isPro
                  ? auth.subscription.status === "trialing"
                    ? "Pro · пробный период"
                    : "План Pro"
                  : "План Free"}
              </span>
            )}
            <button type="button" className="btn btn-accent" onClick={() => void auth.logout()}>
              Выйти
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel">
        <div className="auth-panel-head">
          <h1>Облако Relay</h1>
          <p className="muted">
            Sync, команда и 14 дней Pro. Без входа всё остаётся локально на этом ПК.
          </p>
        </div>

        <div className="auth-switch" role="tablist" aria-label="Вход или регистрация">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            data-active={mode === "login"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            data-active={mode === "register"}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Регистрация
          </button>
        </div>

        <div className="oauth-row oauth-row-3">
          {PROVIDERS.map(({ id, label, mark: Mark }) => {
            const active = flow?.provider === id;
            const disabled = busy || (!!flow && !active);
            return (
              <button
                key={id}
                type="button"
                className="oauth-btn"
                data-provider={id}
                data-busy={active || undefined}
                disabled={disabled}
                onClick={() => void provider(id)}
              >
                <span className="oauth-mark">{active ? <Spinner /> : <Mark size={20} />}</span>
                <span className="oauth-label">
                  {active
                    ? flow?.stage === "opening"
                      ? "Открываем…"
                      : "Ждём…"
                    : label}
                </span>
              </button>
            );
          })}
        </div>

        {flow?.stage === "waiting" && (
          <div className="oauth-hint">
            <p className="muted">
              Заверши вход в браузере — приложение подхватит сессию само. Окно не закрывай.
            </p>
            <div className="oauth-hint-actions">
              {flow.url && (
                <button type="button" className="btn btn-xs" onClick={() => void openExternal(flow.url!)}>
                  Открыть ссылку снова
                </button>
              )}
              <button type="button" className="btn btn-xs" onClick={auth.cancelOAuth}>
                Отменить
              </button>
            </div>
          </div>
        )}

        <div className="auth-divider">
          <span>или по email</span>
        </div>

        <form onSubmit={(e) => void submit(e)} className="auth-form">
          {mode === "register" && (
            <label className="field">
              <span>Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
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
          <button type="submit" className="btn btn-accent auth-submit" disabled={busy || !!flow}>
            {busy ? "…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}
      </section>
    </div>
  );
}
