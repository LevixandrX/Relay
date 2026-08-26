"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Props = {
  variant?: "toolbar" | "sidebar" | "floating" | "landing" | "inline";
};

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ variant = "toolbar" }: Props) {
  const t = useTranslations("theme");
  const tc = useTranslations("common");
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const resolved = resolvedTheme === "dark" ? "dark" : "light";
  const Icon = resolved === "dark" ? Moon : Sun;
  const nextLabel = resolved === "dark" ? t("switchToLight") : t("switchToDark");

  const btnClass =
    variant === "sidebar"
      ? "relay-icon-btn"
      : variant === "floating"
        ? "relay-btn relay-theme-floating-btn"
        : variant === "landing"
          ? "ld-nav-theme-btn"
          : "relay-btn relay-btn-ghost relay-theme-toolbar-btn";

  function toggleTheme() {
    const stored = theme ?? "system";
    const next = resolved === "dark" ? "light" : "dark";

    if (stored === "system") {
      setTheme(next);
      return;
    }

    if (next === systemTheme()) {
      setTheme("system");
      return;
    }

    setTheme(next);
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className={btnClass}
        aria-label={tc("theme")}
        disabled
        aria-hidden
      />
    );
  }

  const outerClass =
    variant === "floating"
      ? ""
      : variant === "sidebar"
        ? "relay-theme-sidebar-only"
        : variant === "toolbar"
          ? "relay-theme-toolbar-only"
          : "";

  return (
    <button
      type="button"
      className={[outerClass, btnClass].filter(Boolean).join(" ")}
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggleTheme}
    >
      <Icon size={16} strokeWidth="2" aria-hidden />
      {variant === "inline" && (
        <span className="relay-theme-btn-label">{tc("theme")}</span>
      )}
    </button>
  );
}
