"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PasswordField } from "@/components/PasswordField";
import { OAuthButtons, oauthErrorText } from "@/components/OAuthButtons";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("error");
    if (!code) return;
    setProviderError(oauthErrorText(code, t));
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message ?? t("loginFailed"));
      return;
    }
    router.push("/app");
  }

  return (
    <div className="relay-auth">
      <div className="relay-auth-floating-actions">
        <LanguageToggle variant="floating" />
        <ThemeToggle variant="floating" />
      </div>
      <form className="relay-auth-card" onSubmit={onSubmit}>
        <BrandLockup href="/" />
        <h1>{t("loginTitle")}</h1>
        <p className="lede">{t("loginLede")}</p>
        {providerError && <p className="relay-error">{providerError}</p>}
        <div className="relay-field">
          <label htmlFor="email">{tc("email")}</label>
          <input
            id="email"
            type="email"
            className="relay-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <PasswordField
          id="password"
          label={tc("password")}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error && <p className="relay-error">{error}</p>}
        <button className="relay-btn relay-btn-accent" style={{ width: "100%" }} disabled={loading}>
          {loading ? t("loginSubmitting") : t("loginSubmit")}
        </button>
        <OAuthButtons />
        <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          {t("newHere")} <Link href="/register">{t("createAccount")}</Link>
        </p>
      </form>
    </div>
  );
}
