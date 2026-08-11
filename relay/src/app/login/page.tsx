"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { OAuthButtons, oauthErrorText } from "@/components/OAuthButtons";
import { BrandLockup } from "@/components/BrandMark";

export default function LoginPage() {
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
    setProviderError(oauthErrorText(code));
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

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
      setError(data.message ?? "Не удалось войти");
      return;
    }
    router.push("/app");
  }

  return (
    <div className="relay-auth">
      <form className="relay-auth-card" onSubmit={onSubmit}>
        <BrandLockup href="/" />
        <h1>С возвращением</h1>
        <p className="lede">Продолжи там, где остановился — холст или страница.</p>
        {providerError && <p className="relay-error">{providerError}</p>}
        <div className="relay-field">
          <label htmlFor="email">Email</label>
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
          label="Пароль"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error && <p className="relay-error">{error}</p>}
        <button className="relay-btn relay-btn-accent" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Входим…" : "Войти"}
        </button>
        <OAuthButtons />
        <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          Новый здесь? <Link href="/register">Создать аккаунт</Link>
        </p>
      </form>
    </div>
  );
}
