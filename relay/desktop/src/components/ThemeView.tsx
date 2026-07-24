import { ACCENTS, type AccentId } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";

export function ThemeView() {
  const theme = useTheme();

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>Тема оформления</h1>
        </div>
      </div>

      <section className="card theme-panel">
        <div>
          <h2 style={{ margin: "0 0 0.55rem" }}>Режим</h2>
          <div className="segment">
            {(
              [
                ["dark", "Тёмная"],
                ["light", "Светлая"],
                ["system", "Системная"],
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
          <h2 style={{ margin: "0 0 0.55rem" }}>Акцент</h2>
          <div className="swatches">
            {(Object.keys(ACCENTS) as Exclude<AccentId, "custom">[]).map((id) => (
              <button
                key={id}
                type="button"
                className="swatch"
                title={ACCENTS[id].label}
                data-active={theme.accent === id}
                style={{ background: ACCENTS[id].hex }}
                onClick={() => theme.setAccent(id)}
              />
            ))}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {theme.accent === "custom"
              ? "Свой цвет"
              : ACCENTS[theme.accent as Exclude<AccentId, "custom">].label}
          </p>
        </div>

        <div>
          <h2 style={{ margin: "0 0 0.55rem" }}>Своя тема</h2>
          <div className="custom-row">
            <input
              type="color"
              value={theme.customAccent}
              onChange={(e) => theme.setCustomAccent(e.target.value)}
              aria-label="Свой акцентный цвет"
            />
            <span className="muted">Выбери любой акцент — свечение подстроится автоматически</span>
          </div>
        </div>
      </section>
    </>
  );
}
