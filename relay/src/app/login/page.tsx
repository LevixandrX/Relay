"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/PasswordField";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        <div className="relay-brand">
          Relay<span className="relay-brand-dot" />
        </div>
        <h1>С возвращением</h1>
        <p className="lede">Продолжи там, где остановился — холст или страница.</p>
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
        <div className="relay-oauth-row">
          <a className="relay-btn" href="/api/v1/auth/oauth/google?client=web">
            Google
          </a>
          <a className="relay-btn" href="/api/v1/auth/oauth/github?client=web">
            GitHub
          </a>
        </div>
        <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          Новый здесь? <Link href="/register">Создать аккаунт</Link>
        </p>
      </form>
    </div>
  );
}
