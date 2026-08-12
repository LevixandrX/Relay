export type ThemeMode = "dark" | "light" | "system";

export type AccentId = "cobalt" | "mint" | "rose" | "amber" | "violet" | "custom";

export type ThemeState = {
  mode: ThemeMode;
  accent: AccentId;
  customAccent: string; // hex
};

export const ACCENTS: Record<
  Exclude<AccentId, "custom">,
  { hex: string; glow: string }
> = {
  cobalt: { hex: "#3b82f6", glow: "rgba(59, 130, 246, 0.35)" },
  mint: { hex: "#2dd4bf", glow: "rgba(45, 212, 191, 0.32)" },
  rose: { hex: "#fb7185", glow: "rgba(251, 113, 133, 0.32)" },
  amber: { hex: "#f59e0b", glow: "rgba(245, 158, 11, 0.32)" },
  violet: { hex: "#a78bfa", glow: "rgba(167, 139, 250, 0.32)" },
};

export const DEFAULT_THEME: ThemeState = {
  mode: "dark",
  accent: "cobalt",
  customAccent: "#60a5fa",
};

const STORAGE_KEY = "relay-desktop-theme-v1";

export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: ThemeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

export function resolveAccent(theme: ThemeState) {
  if (theme.accent === "custom") {
    return { hex: theme.customAccent, glow: hexToGlow(theme.customAccent) };
  }
  return ACCENTS[theme.accent];
}

function hexToGlow(hex: string) {
  const c = hex.replace("#", "");
  const n = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, 0.34)`;
}

export function applyThemeToDom(theme: ThemeState) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effective =
    theme.mode === "system" ? (prefersDark ? "dark" : "light") : theme.mode;
  root.dataset.theme = effective;

  const accent = resolveAccent(theme);
  root.style.setProperty("--accent", accent.hex);
  root.style.setProperty("--accent-glow", accent.glow);
}
