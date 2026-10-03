import { ACCENTS, SCHEMES, type AccentId, type SchemeId } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useAppLocale } from "../i18n/LocaleProvider";
import { locales, type AppLocale } from "../i18n/config";
import { useTranslations } from "use-intl";
import type { ChromeMode } from "../lib/chrome";
import { ColorField } from "./ColorField";
import { OverlayScroll } from "@relay-board/CompactRailScroll";

const SCHEME_KEYS = {
  midnight: "schemeMidnight",
  paper: "schemePaper",
  ink: "schemeInk",
  forest: "schemeForest",
  dusk: "schemeDusk",
  snow: "schemeSnow",
} as const;

const CHROME_PRESETS = [
  { id: "flat", transparency: 0, blur: 0, radius: 2 },
  { id: "solid", transparency: 0, blur: 0, radius: 8 },
  { id: "soft", transparency: 28, blur: 14, radius: 10 },
  { id: "glass", transparency: 52, blur: 22, radius: 10 },
  { id: "frost", transparency: 70, blur: 32, radius: 14 },
  { id: "round", transparency: 40, blur: 18, radius: 22 },
] as const;

export function ThemeView({
  chrome,
  onChrome,
}: {
  chrome: ChromeMode;
  onChrome: (mode: ChromeMode) => void;
}) {
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

  const layouts: { id: ChromeMode; label: string; hint: string }[] = [
    { id: "normal", label: t("chromeLayout_normal"), hint: t("chromeLayoutHint_normal") },
    { id: "compact", label: t("chromeLayout_compact"), hint: t("chromeLayoutHint_compact") },
    { id: "zen", label: t("chromeLayout_zen"), hint: t("chromeLayoutHint_zen") },
  ];

  const chromePreset =
    CHROME_PRESETS.find(
      (p) =>
        p.transparency === theme.transparency &&
        p.blur === theme.blur &&
        p.radius === theme.radius,
    )?.id ?? null;

  return (
    <OverlayScroll arrows className="page-frame-scroll" contentClassName="page-frame theme-page">
      <div className="toprow">
        <div className="page-title">
          <h1>{t("themeTitle")}</h1>
        </div>
      </div>
      <p className="theme-lede muted">{t("themeLede")}</p>

      <div className="theme-stage">
        <div className="theme-preview" data-layout={chrome} aria-hidden>
          <div className="theme-preview-canvas" />
          <div className="theme-preview-window">
            <div className="theme-preview-bar">
              <span className="theme-preview-dot" />
              <span className="theme-preview-dot" />
              <span className="theme-preview-dot" />
              <span className="theme-preview-title">Relay</span>
            </div>
            <div className="theme-preview-body">
              <div className="theme-preview-rail">
                <span />
                <span />
                <span />
              </div>
              <div className="theme-preview-main">
                <div className="theme-preview-line" style={{ width: "42%" }} />
                <div className="theme-preview-line" style={{ width: "68%" }} />
                <div className="theme-preview-chip" />
              </div>
            </div>
          </div>
        </div>

        <section className="settings-section theme-surfaces">
          <header className="settings-section-head">
            <h2>{t("chromeTitle")}</h2>
            <p className="muted">{t("chromeHint")}</p>
          </header>
          <div className="chrome-rows">
            <div className="chrome-presets" role="group" aria-label={t("chromeTitle")}>
              {CHROME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chrome-preset"
                  data-active={chromePreset === p.id}
                  onClick={() => {
                    theme.setTransparency(p.transparency);
                    theme.setBlur(p.blur);
                    theme.setRadius(p.radius);
                  }}
                >
                  {t(
                    p.id === "flat"
                      ? "chromePresetFlat"
                      : p.id === "solid"
                        ? "chromePresetSolid"
                        : p.id === "soft"
                          ? "chromePresetSoft"
                          : p.id === "glass"
                            ? "chromePresetGlass"
                            : p.id === "frost"
                              ? "chromePresetFrost"
                              : "chromePresetRound",
                  )}
                </button>
              ))}
            </div>
            <SurfaceSlider
              label={t("chromeGlass")}
              value={theme.transparency}
              min={0}
              max={80}
              unit="%"
              onChange={theme.setTransparency}
            />
            <SurfaceSlider
              label={t("chromeBlur")}
              value={theme.blur}
              min={0}
              max={40}
              unit="px"
              onChange={theme.setBlur}
            />
            <SurfaceSlider
              label={t("chromeRadius")}
              value={theme.radius}
              min={0}
              max={24}
              unit="px"
              onChange={theme.setRadius}
            />
          </div>
        </section>
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
          <h2>{t("chromeLayout")}</h2>
          <p className="muted">{t("chromeLayoutHint")}</p>
        </header>
        <div className="layout-cards" role="radiogroup" aria-label={t("chromeLayout")}>
          {layouts.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="layout-card"
              role="radio"
              aria-checked={chrome === opt.id}
              data-active={chrome === opt.id}
              data-layout={opt.id}
              onClick={() => onChrome(opt.id)}
            >
              <LayoutMock mode={opt.id} />
              <span className="layout-card-copy">
                <strong>{opt.label}</strong>
                <span className="muted">{opt.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-head">
          <h2>{t("themeSchemes")}</h2>
          <p className="muted">{t("themeSchemesHint")}</p>
        </header>
        <div className="scheme-grid" role="radiogroup" aria-label={t("themeSchemes")}>
          {(Object.keys(SCHEMES) as SchemeId[]).map((id) => {
            const scheme = SCHEMES[id];
            return (
              <button
                key={id}
                type="button"
                className="scheme-card"
                role="radio"
                aria-checked={theme.scheme === id}
                data-active={theme.scheme === id}
                onClick={() => theme.applyScheme(id)}
              >
                <span className="scheme-swatch" aria-hidden>
                  <span style={{ background: scheme.bg }} />
                  <span style={{ background: scheme.surface }} />
                  <span style={{ background: scheme.accent }} />
                </span>
                <strong>{t(SCHEME_KEYS[id])}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <div className="theme-pair">
      <section className="settings-section">
        <header className="settings-section-head">
          <h2>{t("themeColors")}</h2>
          <p className="muted">{t("themeColorsHint")}</p>
        </header>
        <div className="color-grid">
          <ColorField
            label={t("themeAccent")}
            hint={t("themeAccentHint")}
            value={theme.accent === "custom" ? theme.customAccent : ACCENTS[theme.accent as Exclude<AccentId, "custom">]?.hex ?? theme.customAccent}
            fallback={theme.customAccent}
            resetLabel={t("themeColorReset")}
            hexLabel={t("themeHex")}
            rgbLabel={t("themeRgb")}
            hslLabel={t("themeHsl")}
            pickLabel={t("themePick")}
            onChange={(hex) => {
              if (hex) theme.setCustomAccent(hex);
              else theme.setAccent("cobalt");
            }}
          />
          <ColorField
            label={t("themeBg")}
            hint={t("themeBgHint")}
            value={theme.colorBg}
            fallback={theme.mode === "light" ? "#f4f4f5" : "#111111"}
            resetLabel={t("themeColorReset")}
            hexLabel={t("themeHex")}
            rgbLabel={t("themeRgb")}
            hslLabel={t("themeHsl")}
            pickLabel={t("themePick")}
            onChange={theme.setColorBg}
          />
          <ColorField
            label={t("themeSurface")}
            hint={t("themeSurfaceHint")}
            value={theme.colorSurface}
            fallback={theme.mode === "light" ? "#ffffff" : "#1c1c1c"}
            resetLabel={t("themeColorReset")}
            hexLabel={t("themeHex")}
            rgbLabel={t("themeRgb")}
            hslLabel={t("themeHsl")}
            pickLabel={t("themePick")}
            onChange={theme.setColorSurface}
          />
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
      </div>
    </OverlayScroll>
  );
}

function SurfaceSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="prop-row">
      <span className="prop-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        style={{ ["--pct" as string]: `${((value - min) / (max - min)) * 100}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="prop-value">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          aria-label={label}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <em>{unit}</em>
      </span>
    </label>
  );
}

function LayoutMock({ mode }: { mode: ChromeMode }) {
  return (
    <span className="layout-mock" data-layout={mode} aria-hidden>
      <span className="layout-mock-bar">
        <span />
        <span />
        <span />
      </span>
      <span className="layout-mock-body">
        <span className="layout-mock-side">
          <i />
          <i />
          <i />
        </span>
        <span className="layout-mock-main">
          <em />
          <em />
        </span>
      </span>
    </span>
  );
}
