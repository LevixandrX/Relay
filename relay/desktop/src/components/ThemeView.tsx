import { ACCENTS, type AccentId } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useAppLocale } from "../i18n/LocaleProvider";
import { locales, type AppLocale } from "../i18n/config";
import { useTranslations } from "use-intl";

const ACCENT_KEYS = {
  cobalt: "accentCobalt",
  mint: "accentMint",
  rose: "accentRose",
  amber: "accentAmber",
  violet: "accentViolet",
} as const;

export function ThemeView() {
  const theme = useTheme();
  const t = useTranslations("desktop");
  const tl = useTranslations("locale");
  const { locale, setLocale } = useAppLocale();

  const modeOptions = [
    {
      id: "system" as const,
      label: t("themeSystem"),
      hint: t("themeSystemHint"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 3.5v17" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" opacity="0.35" />
        </svg>
      ),
    },
    {
      id: "light" as const,
      label: t("themeLight"),
      hint: t("themeLightHint"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 3.2v2M12 18.8v2M3.2 12h2M18.8 12h2M5.9 5.9l1.4 1.4M16.7 16.7l1.4 1.4M18.1 5.9l-1.4 1.4M7.3 16.7l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      id: "dark" as const,
      label: t("themeDark"),
      hint: t("themeDarkHint"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M16.5 3.8A8.6 8.6 0 1 0 20.2 14 7 7 0 0 1 16.5 3.8Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>{t("themeTitle")}</h1>
        </div>
      </div>
      <p className="theme-lede muted">{t("themeLede")}</p>

      <div className="theme-preview" aria-hidden>
        <div className="theme-preview-bar">
          <span className="theme-preview-dot" />
          <span className="theme-preview-dot" />
          <span className="theme-preview-dot" />
          <span className="theme-preview-title">Relay</span>
        </div>
        <div className="theme-preview-body">
          <div className="theme-preview-rail" />
          <div className="theme-preview-main">
            <div className="theme-preview-line" style={{ width: "42%" }} />
            <div className="theme-preview-line" style={{ width: "68%" }} />
            <div className="theme-preview-chip" />
          </div>
        </div>
      </div>

      <section className="settings-section">
        <header className="settings-section-head">
          <h2>{t("themeMode")}</h2>
          <p className="muted">{t("themeModeHint")}</p>
        </header>
        <div className="mode-cards" role="radiogroup" aria-label={t("themeMode")}>
          {modeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="mode-card"
              role="radio"
              aria-checked={theme.mode === opt.id}
              data-active={theme.mode === opt.id}
              onClick={() => theme.setMode(opt.id)}
            >
              <span className="mode-card-icon" aria-hidden>
                {opt.icon}
              </span>
              <span className="mode-card-copy">
                <strong>{opt.label}</strong>
                <span className="muted">{opt.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-head">
          <h2>{t("themeAccent")}</h2>
          <p className="muted">{t("themeAccentHint")}</p>
        </header>
        <div className="accent-grid">
          {(Object.keys(ACCENTS) as Exclude<AccentId, "custom">[]).map((id) => (
            <button
              key={id}
              type="button"
              className="accent-option"
              data-active={theme.accent === id}
              onClick={() => theme.setAccent(id)}
            >
              <span className="accent-dot" style={{ background: ACCENTS[id].hex }} />
              <span>{t(ACCENT_KEYS[id])}</span>
            </button>
          ))}
          <label className="accent-option accent-custom" data-active={theme.accent === "custom"}>
            <span className="accent-dot accent-dot-custom" style={{ background: theme.customAccent }} />
            <span>{t("themeCustomColor")}</span>
            <input
              type="color"
              value={theme.customAccent}
              onChange={(e) => theme.setCustomAccent(e.target.value)}
              aria-label={t("themeCustomColor")}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-head">
          <h2>{t("languageHint")}</h2>
          <p className="muted">{t("languageSectionHint")}</p>
        </header>
        <div className="lang-row" role="radiogroup" aria-label={t("languageHint")}>
          {locales.map((id) => (
            <button
              key={id}
              type="button"
              className="lang-option"
              role="radio"
              aria-checked={locale === id}
              data-active={locale === id}
              onClick={() => setLocale(id as AppLocale)}
            >
              <span className="lang-code">{id.toUpperCase()}</span>
              <span>{tl(id)}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
