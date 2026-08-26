"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { GithubMark, GoogleMark, YandexMark } from "@/components/ProviderMarks";

/** VK ID requires business/INN verification — kept out of UI until that exists. */
const PROVIDERS = [
  { id: "google", label: "Google", mark: GoogleMark },
  { id: "github", label: "GitHub", mark: GithubMark },
  { id: "yandex", label: "Яндекс", mark: YandexMark },
] as const;

function oauthHref(provider: string, next: string | null) {
  const q = new URLSearchParams({ client: "web" });
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    q.set("next", next);
  }
  return `/api/v1/auth/oauth/${provider}?${q.toString()}`;
}

function OAuthRow({ next }: { next: string | null }) {
  const t = useTranslations("auth");
  return (
    <>
      <div className="relay-divider">
        <span>{t("orContinueWith")}</span>
      </div>
      <div className="relay-oauth-row relay-oauth-row-3">
        {PROVIDERS.map(({ id, label, mark: Mark }) => (
          <a
            key={id}
            className="relay-oauth-btn"
            href={oauthHref(id, next)}
            aria-label={t("continueWith", { provider: label })}
          >
            <Mark size={20} />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </>
  );
}

function OAuthButtonsWithNext() {
  const search = useSearchParams();
  return <OAuthRow next={search.get("next")} />;
}

export function OAuthButtons() {
  return (
    <Suspense fallback={<OAuthRow next={null} />}>
      <OAuthButtonsWithNext />
    </Suspense>
  );
}

/** OAuth failures come back as ?error=CODE on /login — keep the copy human. */
export function oauthErrorText(code: string | null, t: (key: string) => string): string | null {
  if (!code) return null;
  if (/access_denied/i.test(code)) return t("oauthAccessDenied");
  if (/EMAIL_CONFLICT/i.test(code)) return t("oauthEmailConflict");
  if (/EMAIL_REQUIRED/i.test(code)) return t("oauthEmailRequired");
  if (/TOKEN_FAILED|PROFILE_FAILED/i.test(code)) return t("oauthTokenFailed");
  if (/oauth_not_configured|not set/i.test(code)) return t("oauthNotConfigured");
  return t("oauthGeneric");
}
