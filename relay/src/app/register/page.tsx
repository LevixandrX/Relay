"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PasswordField } from "@/components/PasswordField";
import { OAuthButtons } from "@/components/OAuthButtons";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [intent, setIntent] = useState<"write" | "plan" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const starters = useMemo(
    () =>
      [
        {
          id: "write" as const,
          title: t("starterWriteTitle"),
          preview: [t("starterWritePreview1"), t("starterWritePreview2"), t("starterWritePreview3")],
          desc: t("starterWriteDesc"),
        },
        {
          id: "plan" as const,
          title: t("starterPlanTitle"),
          preview: [t("starterPlanPreview1"), t("starterPlanPreview2"), t("starterPlanPreview3")],
          desc: t("starterPlanDesc"),
        },
        {
          id: "team" as const,
          title: t("starterTeamTitle"),
          preview: [t("starterTeamPreview1"), t("starterTeamPreview2"), t("starterTeamPreview3")],
          desc: t("starterTeamDesc"),
        },
      ] as const,
    [t],
  );

  function goNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 1) {
      setError(t("errorName"));
      return;
    }
    if (!email.includes("@")) {
      setError(t("errorEmail"));
      return;
    }
    if (password.length < 8) {
      setError(t("errorPassword"));
      return;
    }
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent) {
      setError(t("errorIntent"));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, intent }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message ?? t("registerFailed"));
      return;
    }
    router.push(`/w/${data.workspaceId}/board`);
  }

  return (
    <div className="relay-auth">
      <div className="relay-auth-floating-actions">
        <LanguageToggle variant="floating" />
        <ThemeToggle variant="floating" />
      </div>
      {step === 1 ? (
        <form className="relay-auth-card" onSubmit={goNext}>
          <BrandLockup href="/" />
          <h1>{t("registerTitle")}</h1>
          <p className="lede">{t("registerLede")}</p>

          <div className="relay-field">
            <label htmlFor="name">{tc("name")}</label>
            <input
              id="name"
              className="relay-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
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
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && <p className="relay-error">{error}</p>}
          <button className="relay-btn relay-btn-accent" style={{ width: "100%" }} type="submit">
            {t("registerNext")}
          </button>
          <OAuthButtons />
          <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
            {t("haveAccount")} <Link href="/login">{t("loginSubmit")}</Link>
          </p>
        </form>
      ) : (
        <form className="relay-auth-card relay-auth-wide" onSubmit={onSubmit}>
          <BrandLockup href="/" />
          <button type="button" className="relay-back" onClick={() => setStep(1)}>
            ← {t("registerBack")}
          </button>
          <h1>{t("intentTitle")}</h1>
          <p className="lede">{t("intentLede")}</p>

          <div className="relay-starter-grid">
            {starters.map((item) => (
              <button
                key={item.id}
                type="button"
                className="relay-starter"
                data-active={intent === item.id}
                onClick={() => {
                  setIntent(item.id);
                  setError(null);
                }}
              >
                <strong>{item.title}</strong>
                <span className="relay-starter-desc">{item.desc}</span>
                <span className="relay-starter-preview">
                  {item.preview.map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </span>
              </button>
            ))}
          </div>

          {error && <p className="relay-error">{error}</p>}
          <button
            className="relay-btn relay-btn-accent"
            style={{ width: "100%" }}
            disabled={loading || !intent}
            type="submit"
          >
            {loading ? t("intentSubmitting") : t("intentSubmit")}
          </button>
        </form>
      )}
    </div>
  );
}
