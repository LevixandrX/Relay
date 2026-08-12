import { ACCENTS, type AccentId } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslations } from "use-intl";

export function ThemeView() {
  const theme = useTheme();
  const t = useTranslations("desktop");

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>{t("themeTitle")}</h1>
        </div>
      </div>

      <section className="card theme-panel">
        <div>
          <h2 style={{ margin: "0 0 0.55rem" }}>{t("languageHint")}</h2>
          <LanguageToggle />
        </div>

        <div>
          <h2 style={{ margin: "0 0 0.55rem" }}>{t("themeMode")}</h2>
          <div className="segment">
            {(
              [
                ["dark", t("themeDark")],
                ["light", t("themeLight")],
                ["system", t("themeSystem")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-active={theme.mode === id}
                onClick={() => theme.setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ margin: "0 0 0.55rem" }}>{t("themeAccent")}</h2>
          <div className="swatches">
            {(Object.keys(ACCENTS) as Exclude<AccentId, "custom">[]).map((id) => {
              const label = t(
                (
                  {
                    cobalt: "accentCobalt",
                    mint: "accentMint",
                    rose: "accentRose",
                    amber: "accentAmber",
                    violet: "accentViolet",
                  } as const
                )[id],
              );
              return (
                <button
                  key={id}
                  type="button"
                  className="swatch"
                  title={label}
                  data-active={theme.accent === id}
                  style={{ background: ACCENTS[id].hex }}
                  onClick={() => theme.setAccent(id)}
                />
              );
            })}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {theme.accent === "custom"
              ? t("themeCustomColor")
              : t(
                  (
                    {
                      cobalt: "accentCobalt",
                      mint: "accentMint",
                      rose: "accentRose",
                      amber: "accentAmber",
                      violet: "accentViolet",
                    } as const
                  )[theme.accent],
                )}
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 0.55rem" }}>{t("themeCustom")}</h2>
          <div className="custom-row">
            <input
              type="color"
              value={theme.customAccent}
              onChange={(e) => theme.setCustomAccent(e.target.value)}
              aria-label={t("themeCustomColor")}
            />
            <span className="muted">{t("themeCustomHint")}</span>
          </div>
        </div>
      </section>
    </>
  );
}
