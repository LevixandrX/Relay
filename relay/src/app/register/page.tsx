"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { OAuthButtons } from "@/components/OAuthButtons";
import { BrandLockup } from "@/components/BrandMark";

const STARTERS = [
  {
    id: "write" as const,
    title: "Пишу и собираю мысли",
    preview: ["Черновик", "Заметки", "Холст идей"],
    desc: "Стартовые страницы под тексты и свободный холст.",
  },
  {
    id: "plan" as const,
    title: "Планирую проект",
    preview: ["Дорожная карта", "Неделя", "Холст плана"],
    desc: "Чеклисты, этапы и схема на холсте.",
  },
  {
    id: "team" as const,
    title: "Веду команду",
    preview: ["Хаб", "Встречи", "Холст ролей"],
    desc: "Общее пространство и зоны ответственности.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [intent, setIntent] = useState<"write" | "plan" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function goNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 1) {
      setError("Укажи имя");
      return;
    }
    if (!email.includes("@")) {
      setError("Похоже, email указан неверно");
      return;
    }
    if (password.length < 8) {
      setError("Пароль — минимум 8 символов");
      return;
    }
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent) {
      setError("Выбери, с чего начнём — так мы подготовим пространство");
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
      setError(data.message ?? "Не удалось зарегистрироваться");
      return;
    }
    router.push(`/w/${data.workspaceId}/board`);
  }

  return (
    <div className="relay-auth">
      {step === 1 ? (
        <form className="relay-auth-card" onSubmit={goNext}>
          <BrandLockup href="/" />
          <h1>Создай аккаунт</h1>
          <p className="lede">Потом выберешь старт пространства — займёт секунду.</p>

          <div className="relay-field">
            <label htmlFor="name">Имя</label>
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
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && <p className="relay-error">{error}</p>}
          <button className="relay-btn relay-btn-accent" style={{ width: "100%" }} type="submit">
            Дальше
          </button>
          <OAuthButtons />
          <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
            Уже есть аккаунт? <Link href="/login">Войти</Link>
          </p>
        </form>
      ) : (
        <form className="relay-auth-card relay-auth-wide" onSubmit={onSubmit}>
          <BrandLockup href="/" />
          <button type="button" className="relay-back" onClick={() => setStep(1)}>
            ← Назад
          </button>
          <h1>С чего начнём?</h1>
          <p className="lede">
            Выбери сценарий — мы подготовим страницы и откроем холст. Без выбора дальше нельзя.
          </p>

          <div className="relay-starter-grid">
            {STARTERS.map((item) => (
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
            {loading ? "Создаём…" : "Открыть пространство"}
          </button>
        </form>
      )}
    </div>
  );
}
