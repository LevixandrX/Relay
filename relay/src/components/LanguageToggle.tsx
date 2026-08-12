"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AppLocale } from "@/i18n/config";
import { locales } from "@/i18n/config";

type Variant = "toolbar" | "sidebar" | "floating" | "landing" | "inline";

type Props = {
  variant?: Variant;
  /** `cycle` = one label EN↔RU. `menu` = dropdown (kept for future multi-locale). */
  mode?: "cycle" | "menu";
};

/** Preview-only locales for the future menu — not selectable yet. */
const PREVIEW_LOCALES = [
  { id: "de", nameKey: "de" as const },
  { id: "es", nameKey: "es" as const },
  { id: "fr", nameKey: "fr" as const },
] as const;

function btnClassFor(variant: Variant) {
  if (variant === "sidebar") return "relay-icon-btn";
  if (variant === "floating") return "relay-btn relay-theme-floating-btn";
  if (variant === "landing") return "ld-nav-theme-btn";
  return "relay-btn relay-btn-ghost relay-theme-toolbar-btn";
}

function wrapClassFor(variant: Variant) {
  if (variant === "floating") return "relay-menu-wrap";
  if (variant === "sidebar") return "relay-theme-sidebar-only relay-menu-wrap";
  if (variant === "toolbar") return "relay-theme-toolbar-only relay-menu-wrap";
  return "relay-menu-wrap";
}

async function persistLocale(next: AppLocale) {
  await fetch("/api/v1/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: next }),
  });
}

/** One-click EN ↔ RU — primary control in the UI. */
export function LanguageToggle({ variant = "toolbar", mode = "cycle" }: Props) {
  if (mode === "menu") return <LanguageMenu variant={variant} />;
  return <LanguageCycle variant={variant} />;
}

function LanguageCycle({ variant }: { variant: Variant }) {
  const t = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function cycle() {
    const next: AppLocale = locale === "ru" ? "en" : "ru";
    await persistLocale(next);
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      className={btnClassFor(variant)}
      aria-label={t("label")}
      title={t("cycleHint")}
      disabled={pending}
      onClick={() => void cycle()}
    >
      <span className="relay-locale-code">{locale.toUpperCase()}</span>
    </button>
  );
}

/**
 * Multi-locale dropdown — fixed styling + stub languages.
 * Kept in codebase for later; not mounted in chrome by default.
 */
export function LanguageMenu({ variant = "toolbar" }: { variant?: Variant }) {
  const t = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function setLocale(next: AppLocale) {
    if (next === locale) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await persistLocale(next);
    startTransition(() => router.refresh());
  }

  return (
    <div className={wrapClassFor(variant)} ref={wrapRef}>
      <button
        type="button"
        className={btnClassFor(variant)}
        aria-label={t("label")}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t("label")}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relay-locale-code">{locale.toUpperCase()}</span>
      </button>
      {open && (
        <div className="relay-menu relay-theme-menu" role="menu">
          {locales.map((id) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={locale === id}
              data-active={locale === id}
              onClick={() => void setLocale(id)}
            >
              <span className="relay-locale-code">{id.toUpperCase()}</span>
              <span>{t(id)}</span>
            </button>
          ))}
          <div className="relay-menu-sep" role="separator" />
          {PREVIEW_LOCALES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled
              className="is-preview"
              title={t("comingSoon")}
            >
              <span className="relay-locale-code">{item.id.toUpperCase()}</span>
              <span>{t(item.nameKey)}</span>
              <span className="relay-menu-soon">{t("soonBadge")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
