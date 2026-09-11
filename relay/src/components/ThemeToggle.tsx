"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/ThemeProvider";

type Props = {
  variant?: "toolbar" | "sidebar" | "floating" | "landing" | "inline";
};

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ variant = "toolbar" }: Props) {
  const t = useTranslations("theme");
  const tc = useTranslations("common");
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const resolved = resolvedTheme === "dark" ? "dark" : "light";
  const Icon = resolved === "dark" ? Moon : Sun;
  const nextLabel = ready
    ? resolved === "dark"
      ? t("switchToLight")
      : t("switchToDark")
    : tc("theme");

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
      aria-label={tc("theme")}
      title={nextLabel}
      onClick={toggleTheme}
    >
      <span className="relay-theme-ico" aria-hidden>
        {ready ? <Icon size={16} strokeWidth="2" /> : <span className="relay-theme-ico-slot" />}
      </span>
      {variant === "inline" && (
        <span className="relay-theme-btn-label">{tc("theme")}</span>
      )}
    </button>
  );
}
