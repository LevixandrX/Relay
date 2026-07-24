import { getCurrentWindow } from "@tauri-apps/api/window";

async function safeWindowAction(action: "minimize" | "toggleMaximize" | "close") {
  try {
    const win = getCurrentWindow();
    if (action === "minimize") await win.minimize();
    if (action === "toggleMaximize") await win.toggleMaximize();
    if (action === "close") await win.close();
  } catch {
    // В браузерном preview (@vite) Tauri API нет — игнорируем
  }
}

export function Titlebar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand">
        <span className="titlebar-dot" />
        Relay Desktop
      </div>
      <div className="titlebar-actions">
        <button type="button" className="win-btn" onClick={() => void safeWindowAction("minimize")}>
          ─
        </button>
        <button
          type="button"
          className="win-btn"
          onClick={() => void safeWindowAction("toggleMaximize")}
        >
          □
        </button>
        <button
          type="button"
          className="win-btn close"
          onClick={() => void safeWindowAction("close")}
        >
          ×
        </button>
      </div>
    </header>
  );
}
