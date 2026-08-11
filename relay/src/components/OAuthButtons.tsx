import { GithubMark, GoogleMark, YandexMark } from "@/components/ProviderMarks";

/** VK ID requires business/INN verification — kept out of UI until that exists. */
const PROVIDERS = [
  { id: "google", label: "Google", mark: GoogleMark },
  { id: "github", label: "GitHub", mark: GithubMark },
  { id: "yandex", label: "Яндекс", mark: YandexMark },
] as const;

export function OAuthButtons() {
  return (
    <>
      <div className="relay-divider">
        <span>или продолжить с</span>
      </div>
      <div className="relay-oauth-row relay-oauth-row-3">
        {PROVIDERS.map(({ id, label, mark: Mark }) => (
          <a
            key={id}
            className="relay-oauth-btn"
            href={`/api/v1/auth/oauth/${id}?client=web`}
            aria-label={`Продолжить с ${label}`}
          >
            <Mark size={20} />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </>
  );
}

/** OAuth failures come back as ?error=CODE on /login — keep the copy human. */
export function oauthErrorText(code: string | null): string | null {
  if (!code) return null;
  if (/access_denied/i.test(code)) return "Вход отменён — попробуй ещё раз.";
  if (/EMAIL_CONFLICT/i.test(code)) {
    return "Этот email уже зарегистрирован с паролем. Войди по email/паролю, а провайдера привяжем позже.";
  }
  if (/EMAIL_REQUIRED/i.test(code)) {
    return "У аккаунта нет подтверждённого email. Открой email в настройках провайдера или войди по паролю.";
  }
  if (/TOKEN_FAILED|PROFILE_FAILED/i.test(code)) {
    return "Провайдер не подтвердил вход. Проверь Client ID/Secret и callback URL.";
  }
  if (/oauth_not_configured|not set/i.test(code)) {
    return "OAuth не настроен на сервере: нужны ключи в relay/.env.local.";
  }
  return "Не удалось войти через провайдера. Попробуй ещё раз.";
}
