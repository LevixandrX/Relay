import { useState } from "react";
import { useTranslations } from "use-intl";
import { locales, type AppLocale } from "../i18n/config";
import { useAppLocale } from "../i18n/LocaleProvider";

/** One label — click cycles EN ↔ RU. */
export function LanguageToggle() {
  const t = useTranslations("locale");
  const td = useTranslations("desktop");
  const { locale, setLocale } = useAppLocale();

  function cycle() {
    const next: AppLocale = locale === "ru" ? "en" : "ru";
    setLocale(next);
  }

  return (
    <button
      type="button"
      className="locale-cycle"
      aria-label={td("languageHint")}
      title={t("cycleHint")}
      onClick={cycle}
    >
      {locale.toUpperCase()}
    </button>
  );
}

const PREVIEW = [
  { id: "de", key: "de" as const },
  { id: "es", key: "es" as const },
  { id: "fr", key: "fr" as const },
] as const;

/**
 * Future multi-locale menu — preview only (Appearance page).
 * Not used in chrome; kept to decide later.
 */
export function LanguageMenuPreview() {
  const t = useTranslations("locale");
  const td = useTranslations("desktop");
  const { locale, setLocale } = useAppLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="locale-menu-preview">
      <button
        type="button"
        className="locale-cycle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={td("languageHint")}
        onClick={() => setOpen((v) => !v)}
      >
        {locale.toUpperCase()}
      </button>
      {open && (
        <div className="locale-menu" role="menu">
          {locales.map((id) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={locale === id}
              data-active={locale === id}
              onClick={() => {
                setLocale(id as AppLocale);
                setOpen(false);
              }}
            >
              <span className="locale-menu-code">{id.toUpperCase()}</span>
              <span>{t(id)}</span>
            </button>
          ))}
          <div className="locale-menu-sep" role="separator" />
          {PREVIEW.map((item) => (
            <button key={item.id} type="button" role="menuitem" disabled className="is-preview">
              <span className="locale-menu-code">{item.id.toUpperCase()}</span>
              <span>{t(item.key)}</span>
              <span className="locale-menu-soon">{t("soonBadge")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
