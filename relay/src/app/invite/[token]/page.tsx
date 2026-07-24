"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setMsg("Сначала войди в аккаунт с email из приглашения.");
          return;
        }
        setMsg(data.message || "Не удалось принять приглашение");
        return;
      }
      router.push(`/w/${data.workspaceId}/board`);
    } catch {
      setMsg("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Приглашение в Relay</h1>
        <p style={{ color: "#64748b", marginBottom: "1.25rem" }}>
          Тебя пригласили в командное пространство. Войди в аккаунт с нужным email и подтверди.
        </p>
        {msg && (
          <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>
            {msg}{" "}
            <Link href="/login" style={{ color: "#2563eb" }}>
              Войти
            </Link>
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          style={{
            border: "none",
            background: "#2563eb",
            color: "white",
            padding: "0.7rem 1.1rem",
            borderRadius: 999,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {busy ? "Принимаем…" : "Принять приглашение"}
        </button>
      </div>
    </main>
  );
}
