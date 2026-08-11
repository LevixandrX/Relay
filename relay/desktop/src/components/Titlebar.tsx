import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

async function safeWindowAction(action: "minimize" | "toggleMaximize" | "close") {
  try {
    const win = getCurrentWindow();
    if (action === "minimize") await win.minimize();
    if (action === "toggleMaximize") await win.toggleMaximize();
    if (action === "close") await win.close();
  } catch {
    // browser preview
  }
}

/**
 * Windows 11 caption glyphs via Segoe Fluent Icons when available,
 * SVG fallback otherwise. Codes: ChromeMinimize E921, Maximize E922,
 * Restore E923, Close E8BB.
 */
function CaptionGlyph({ kind }: { kind: "min" | "max" | "restore" | "close" }) {
  const map = {
    min: { fluent: "\uE921", label: "min" },
    max: { fluent: "\uE922", label: "max" },
    restore: { fluent: "\uE923", label: "restore" },
    close: { fluent: "\uE8BB", label: "close" },
  } as const;
  const item = map[kind];

  return (
    <span className="win-glyph" data-kind={item.label} aria-hidden="true">
      <span className="win-glyph-fluent">{item.fluent}</span>
      <svg className="win-glyph-svg" width="10" height="10" viewBox="0 0 10 10">
        {kind === "min" && (
          <path d="M1 5h8" stroke="currentColor" strokeWidth="1" fill="none" />
        )}
        {kind === "max" && (
          <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="none" rx="0.5" />
        )}
        {kind === "restore" && (
          <path
            d="M3 3.5h5v5H3v-5zm1.5-1.5H9.5v5"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
        )}
        {kind === "close" && (
          <path
            d="M2 2l6 6M8 2l-6 6"
            stroke="currentColor"
            strokeWidth="1.05"
            fill="none"
          />
        )}
      </svg>
    </span>
  );
}

export function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setMaximized(await win.isMaximized());
        });
      } catch {
        /* preview */
      }
    })();

    // Prefer Segoe Fluent Icons when the OS font is installed (Win10/11).
    try {
      if (document.fonts?.check('12px "Segoe Fluent Icons"') || document.fonts?.check('12px "Segoe MDL2 Assets"')) {
        document.documentElement.dataset.fluentIcons = "1";
      }
    } catch {
      /* ignore */
    }

    return () => unlisten?.();
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand">
        <img className="titlebar-mark" src="/icon.png" alt="" width={16} height={16} draggable={false} />
        Relay
      </div>
      <div className="titlebar-actions">
        <button
          type="button"
          className="win-btn"
          aria-label="Свернуть"
          title="Свернуть"
          onClick={() => void safeWindowAction("minimize")}
        >
          <CaptionGlyph kind="min" />
        </button>
        <button
          type="button"
          id="relay-snap-btn"
          className="win-btn win-btn-max"
          aria-label={maximized ? "Восстановить" : "Развернуть"}
          title={maximized ? "Восстановить" : "Развернуть"}
          onClick={() => void safeWindowAction("toggleMaximize")}
        >
          <CaptionGlyph kind={maximized ? "restore" : "max"} />
        </button>
        <button
          type="button"
          className="win-btn win-btn-close"
          aria-label="Закрыть"
          title="Закрыть"
          onClick={() => void safeWindowAction("close")}
        >
          <CaptionGlyph kind="close" />
        </button>
      </div>
    </header>
  );
}
