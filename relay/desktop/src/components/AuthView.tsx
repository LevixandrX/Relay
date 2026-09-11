import { useState } from "react";
import { useTranslations } from "use-intl";
import { useAuth } from "../lib/auth";
import { ApiClientError, type OAuthProvider } from "../lib/api";
import { GithubMark, GoogleMark, Spinner, YandexMark } from "./ProviderMarks";
import { openExternal } from "../lib/open-external";
import { useDialog } from "./DialogHost";
import { AccountSettings } from "@relay-account";

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
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const auth = useAuth();
  const dialog = useDialog();
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
      setError(err instanceof ApiClientError ? err.message : ta("loginFailed"));
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
          : t("oauthFailed"),
      );
    }
  }

  function planLabel() {
    if (!auth.subscription) return null;
    if (auth.subscription.isPro) {
      return auth.subscription.status === "trialing" ? t("planProTrial") : t("planPro");
    }
    return t("planFree");
  }

  if (loggedIn) {
    return (
      <div className="auth-shell">
        <section className="auth-panel">
          <div className="auth-panel-head">
            <h1>{t("accountTitle")}</h1>
            <p className="muted">{t("accountConnected")}</p>
          </div>
          {flow ? <p className="muted">{t("oauthBrowserHint")}</p> : null}
          <AccountSettings
            user={auth.user!}
            planLabel={planLabel()}
            busy={busy || Boolean(flow)}
            error={error}
            onSave={async (input) => {
              setBusy(true);
              setError(null);
              try {
                const body: { name: string; avatarUrl?: string | null } = { name: input.name };
                if (input.avatarUrl !== undefined) body.avatarUrl = input.avatarUrl;
                await auth.updateProfile(body);
              } catch (err) {
                setError(err instanceof ApiClientError ? err.message : t("oauthFailed"));
              } finally {
                setBusy(false);
              }
            }}
            onLink={(id) => {
              setError(null);
              void auth.signInWithProvider(id, { intent: "link" }).catch((err) => {
                setError(
                  err instanceof ApiClientError || err instanceof Error
                    ? err.message
                    : t("oauthFailed"),
                );
              });
            }}
            onUnlink={async (id) => {
              setBusy(true);
              setError(null);
              try {
                await auth.unlinkProvider(id);
              } catch (err) {
                setError(err instanceof ApiClientError ? err.message : t("oauthFailed"));
              } finally {
                setBusy(false);
              }
            }}
            onLogout={() => {
              void (async () => {
                const ok = await dialog.confirm({
                  title: tc("logoutConfirm"),
                  confirmLabel: tc("logout"),
                });
                if (ok) await auth.logout();
              })();
            }}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel">
        <div className="auth-panel-head">
          <h1>{t("cloudTitle")}</h1>
          <p className="muted">{t("cloudLede")}</p>
        </div>

        <div className="auth-switch" role="tablist" aria-label={t("modeSwitchAria")}>
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
            {t("tabLogin")}
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
            {t("tabRegister")}
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
                      ? t("oauthOpening")
                      : t("oauthWaiting")
                    : label}
                </span>
              </button>
            );
          })}
        </div>

        {flow?.stage === "waiting" && (
          <div className="oauth-hint">
            <p className="muted">{t("oauthBrowserHint")}</p>
            <div className="oauth-hint-actions">
              {flow.url && (
                <button type="button" className="btn btn-xs" onClick={() => void openExternal(flow.url!)}>
                  {t("oauthOpenAgain")}
                </button>
              )}
              <button type="button" className="btn btn-xs" onClick={auth.cancelOAuth}>
                {tc("cancel")}
              </button>
            </div>
          </div>
        )}

        <div className="auth-divider">
          <span>{t("orByEmail")}</span>
        </div>

        <form onSubmit={(e) => void submit(e)} className="auth-form">
          {mode === "register" && (
            <label className="field">
              <span>{tc("name")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>{tc("email")}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>{tc("password")}</span>
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
            {busy ? "…" : mode === "login" ? tc("login") : tc("register")}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}
      </section>
    </div>
  );
}
