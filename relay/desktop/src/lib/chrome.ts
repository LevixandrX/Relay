import { useCallback, useEffect, useState } from "react";

/**
 * How much of the shell stays on screen.
 * normal — sidebar always visible; compact — icon rail; zen — sidebar hidden
 * until the pointer reaches the left edge; the board takes the window.
 */
export type ChromeMode = "normal" | "compact" | "zen";

const KEY = "relay.desktop.chrome";
const LEGACY_COLLAPSED = "relay.desktop.sidebarCollapsed";
const ORDER: ChromeMode[] = ["normal", "compact", "zen"];

function read(): ChromeMode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "normal" || saved === "compact" || saved === "zen") return saved;
    if (localStorage.getItem(LEGACY_COLLAPSED) === "1") return "compact";
  } catch {
    /* ignore */
  }
  return "normal";
}

export function nextChrome(mode: ChromeMode): ChromeMode {
  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
}

export function useChromeMode() {
  const [mode, setMode] = useState<ChromeMode>("normal");

  useEffect(() => {
    setMode(read());
  }, []);

  const set = useCallback((next: ChromeMode) => {
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { mode, set, cycle: () => set(nextChrome(mode)) };
}
