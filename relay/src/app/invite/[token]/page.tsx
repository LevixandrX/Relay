"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

type Me = { id: string; email: string; name: string } | null;

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const t = useTranslations("invite");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setMe(null);
          return;
        }
        const data = (await res.json()) as { user?: Me };
        if (!cancelled) setMe(data.user ?? null);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function accept() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/invites/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as {
        message?: string;
        code?: string;
        workspaceId?: string;
      };
      if (!res.ok) {
        if (res.status === 401) {
          router.push(loginHref);
          return;
        }
        if (data.code === "email_mismatch") {
          setMsg(t("emailMismatch"));
          return;
        }
        if (data.code === "expired") {
          setMsg(t("expired"));
          return;
        }
        if (data.code === "not_found") {
          setMsg(t("notFound"));
          return;
        }
        setMsg(data.message || t("acceptFailed"));
        return;
      }
      if (data.workspaceId) {
        router.push(`/w/${data.workspaceId}/board`);
        return;
      }
      router.push("/app");
    } catch {
      setMsg(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  const signedIn = Boolean(me);
  const checking = me === undefined;

  return (
    <div className="relay-auth" lang={locale}>
      <div className="relay-auth-floating-actions">
        <LanguageToggle variant="floating" />
        <ThemeToggle variant="floating" />
      </div>
      <div className="relay-auth-card invite-card">
        <BrandLockup href="/" />
        <h1>{t("title")}</h1>
        <p className="lede">{t("lede")}</p>

        {checking ? (
          <p className="muted">{t("checking")}</p>
        ) : signedIn ? (
          <div className="invite-signed">
            <p className="invite-as">
              {t("signedInAs", { email: me!.email })}
            </p>
            <p className="muted invite-note">{t("mustMatch")}</p>
          </div>
        ) : (
          <p className="muted invite-note">{t("needLogin")}</p>
        )}

        {msg && <p className="relay-error">{msg}</p>}

        {signedIn ? (
          <button
            type="button"
            className="relay-btn relay-btn-accent"
            style={{ width: "100%" }}
            disabled={busy}
            onClick={() => void accept()}
          >
            {busy ? t("accepting") : t("accept")}
          </button>
        ) : (
          <Link className="relay-btn relay-btn-accent" style={{ width: "100%", textAlign: "center" }} href={loginHref}>
            {t("signInToAccept")}
          </Link>
        )}

        <p className="invite-footer muted">
          {tc("or")}{" "}
          <Link href="/">{t("backHome")}</Link>
        </p>
      </div>
    </div>
  );
}
