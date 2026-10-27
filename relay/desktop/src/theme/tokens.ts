import { hexIsDark, hexToRgb, parseHex } from "../../../src/lib/color";
export { parseHex, hexToRgb, hexIsDark, hexToHsl, rgbToHex, hslToHex, hexToHsv, hsvToHex } from "../../../src/lib/color";

export type ThemeMode = "dark" | "light" | "system";

export type AccentId = "cobalt" | "mint" | "rose" | "amber" | "violet" | "custom";

export type SchemeId = "midnight" | "paper" | "ink" | "forest" | "dusk" | "snow";

export type ThemeState = {
  mode: ThemeMode;
  accent: AccentId;
  customAccent: string;
  scheme: SchemeId | "custom";
  /** 0 = opaque chrome, 80 = clearly glassy. */
  transparency: number;
  /** Backdrop blur in px (0–40). */
  blur: number;
  /** Corner radius in px (0–24). */
  radius: number;
  colorBg: string | null;
  colorSurface: string | null;
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

export const SCHEMES: Record<
  SchemeId,
  { mode: Exclude<ThemeMode, "system">; accent: string; bg: string; surface: string }
> = {
  midnight: { mode: "dark", accent: "#3b82f6", bg: "#111111", surface: "#1c1c1c" },
  paper: { mode: "light", accent: "#c2410c", bg: "#f3eee6", surface: "#fffaf3" },
  ink: { mode: "dark", accent: "#a1a1aa", bg: "#0c0c0d", surface: "#18181b" },
  forest: { mode: "dark", accent: "#34d399", bg: "#101613", surface: "#18211c" },
  dusk: { mode: "dark", accent: "#fb7185", bg: "#161218", surface: "#221c24" },
  snow: { mode: "light", accent: "#2563eb", bg: "#f4f4f5", surface: "#ffffff" },
};

export const DEFAULT_THEME: ThemeState = {
  mode: "dark",
  accent: "cobalt",
  customAccent: "#60a5fa",
  scheme: "midnight",
  transparency: 48,
  blur: 22,
  radius: 10,
  colorBg: null,
  colorSurface: null,
};

const STORAGE_KEY = "relay-desktop-theme-v1";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function migrate(raw: Record<string, unknown>): ThemeState {
  let transparency = DEFAULT_THEME.transparency;
  let blur = DEFAULT_THEME.blur;
  let radius = DEFAULT_THEME.radius;

  if (typeof raw.transparency === "number") {
    transparency = clamp(raw.transparency, 0, 80);
  } else if (raw.glass === "flat") {
    transparency = 0;
    blur = 0;
  } else if (raw.glass === "glass") {
    transparency = 58;
    blur = 26;
  } else if (raw.glass === "soft") {
    transparency = 28;
    blur = 14;
  }

  if (typeof raw.blur === "number") blur = clamp(raw.blur, 0, 40);

  if (typeof raw.radius === "number") {
    radius = clamp(raw.radius, 0, 24);
  } else if (raw.radius === "sharp") {
    radius = 4;
  } else if (raw.radius === "round") {
    radius = 16;
  } else if (raw.radius === "soft") {
    radius = 10;
  }

  const mode: ThemeMode =
    raw.mode === "light" || raw.mode === "dark" || raw.mode === "system"
      ? raw.mode
      : DEFAULT_THEME.mode;
  let scheme: ThemeState["scheme"] =
    raw.scheme === "midnight" ||
    raw.scheme === "paper" ||
    raw.scheme === "ink" ||
    raw.scheme === "forest" ||
    raw.scheme === "dusk" ||
    raw.scheme === "snow" ||
    raw.scheme === "custom"
      ? raw.scheme
      : "custom";
  let colorBg = typeof raw.colorBg === "string" ? raw.colorBg : null;
  let colorSurface = typeof raw.colorSurface === "string" ? raw.colorSurface : null;

  if (mode === "light" || mode === "dark") {
    const schemeMode = scheme !== "custom" ? SCHEMES[scheme].mode : null;
    if (schemeMode && schemeMode !== mode) {
      scheme = "custom";
      colorBg = null;
      colorSurface = null;
    } else if (!colorsFitMode(colorBg, mode)) {
      scheme = "custom";
      colorBg = null;
      colorSurface = null;
    }
  }

  return {
    mode,
    accent:
      raw.accent === "mint" ||
      raw.accent === "rose" ||
      raw.accent === "amber" ||
      raw.accent === "violet" ||
      raw.accent === "custom" ||
      raw.accent === "cobalt"
        ? raw.accent
        : DEFAULT_THEME.accent,
    customAccent:
      typeof raw.customAccent === "string" ? raw.customAccent : DEFAULT_THEME.customAccent,
    scheme,
    transparency,
    blur,
    radius,
    colorBg,
    colorSurface,
  };
}

export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return migrate(JSON.parse(raw) as Record<string, unknown>);
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

function colorsFitMode(bg: string | null, mode: "light" | "dark") {
  if (!bg) return true;
  return hexIsDark(bg) === (mode === "dark");
}

function hexToGlow(hex: string) {
  const { r, g, b } = hexToRgb(parseHex(hex) ?? "#000000");
  return `rgba(${r}, ${g}, ${b}, 0.34)`;
}

function mixHex(hex: string, toward: "white" | "black", amount: number) {
  const c = hex.replace("#", "");
  const n = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = toward === "white" ? 255 : 0;
  r = Math.round(r + (t - r) * amount);
  g = Math.round(g + (t - g) * amount);
  b = Math.round(b + (t - b) * amount);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
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

  const solid = clamp(100 - theme.transparency, 20, 100);
  const overlayBase = effective === "light" ? 84 : 78;
  const overlayPct =
    theme.transparency === 0 ? 100 : clamp(Math.round(overlayBase + solid * 0.12), overlayBase, 94);
  root.style.setProperty("--chrome-pct", `${solid}%`);
  root.style.setProperty("--chrome-float-pct", `${solid}%`);
  root.style.setProperty("--chrome-overlay-pct", `${overlayPct}%`);
  root.style.setProperty("--chrome-blur", theme.transparency === 0 ? "0px" : `${theme.blur}px`);
  root.style.setProperty("--radius-ui", `${theme.radius}px`);
  root.style.setProperty("--radius", `${theme.radius}px`);
  root.style.setProperty("--radius-sm", `${Math.max(4, theme.radius - 2)}px`);

  if (theme.colorBg && colorsFitMode(theme.colorBg, effective)) {
    root.style.setProperty("--bg", theme.colorBg);
    root.style.setProperty("--canvas", mixHex(theme.colorBg, effective === "dark" ? "black" : "white", 0.08));
  } else {
    root.style.removeProperty("--bg");
    root.style.removeProperty("--canvas");
  }

  if (theme.colorSurface && colorsFitMode(theme.colorSurface, effective)) {
    root.style.setProperty("--surface", theme.colorSurface);
    root.style.setProperty("--card", theme.colorSurface);
    root.style.setProperty(
      "--card-2",
      mixHex(theme.colorSurface, effective === "dark" ? "white" : "black", 0.06),
    );
    root.style.setProperty(
      "--bg-elev",
      mixHex(theme.colorSurface, effective === "dark" ? "black" : "white", 0.04),
    );
  } else {
    root.style.removeProperty("--surface");
    root.style.removeProperty("--card");
    root.style.removeProperty("--card-2");
    root.style.removeProperty("--bg-elev");
  }
}
