import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyThemeToDom,
  hexIsDark,
  loadTheme,
  saveTheme,
  SCHEMES,
  type AccentId,
  type SchemeId,
  type ThemeMode,
  type ThemeState,
} from "./tokens";

type ThemeContextValue = ThemeState & {
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  setCustomAccent: (hex: string) => void;
  applyScheme: (id: SchemeId) => void;
  setTransparency: (n: number) => void;
  setBlur: (n: number) => void;
  setRadius: (n: number) => void;
  setColorBg: (hex: string | null) => void;
  setColorSurface: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeState>(() => loadTheme());

  useEffect(() => {
    applyThemeToDom(theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme.mode === "system") applyThemeToDom(theme);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setMode = useCallback((mode: ThemeMode) => {
    setTheme((t) => {
      const next = { ...t, mode };
      if (mode === "system") return next;
      const schemeMode = t.scheme !== "custom" ? SCHEMES[t.scheme].mode : null;
      const bgClash = t.colorBg != null && hexIsDark(t.colorBg) !== (mode === "dark");
      if ((schemeMode && schemeMode !== mode) || bgClash) {
        return { ...next, colorBg: null, colorSurface: null, scheme: "custom" };
      }
      return next;
    });
  }, []);

  const setAccent = useCallback((accent: AccentId) => {
    setTheme((t) => ({ ...t, accent, scheme: "custom" }));
  }, []);

  const setCustomAccent = useCallback((customAccent: string) => {
    setTheme((t) => ({ ...t, accent: "custom", customAccent, scheme: "custom" }));
  }, []);

  const applyScheme = useCallback((id: SchemeId) => {
    const scheme = SCHEMES[id];
    setTheme((t) => ({
      ...t,
      scheme: id,
      mode: scheme.mode,
      accent: "custom",
      customAccent: scheme.accent,
      colorBg: scheme.bg,
      colorSurface: scheme.surface,
    }));
  }, []);

  const setTransparency = useCallback((transparency: number) => {
    setTheme((t) => ({ ...t, transparency }));
  }, []);

  const setBlur = useCallback((blur: number) => {
    setTheme((t) => ({ ...t, blur }));
  }, []);

  const setRadius = useCallback((radius: number) => {
    setTheme((t) => ({ ...t, radius }));
  }, []);

  const setColorBg = useCallback((colorBg: string | null) => {
    setTheme((t) => ({ ...t, colorBg, scheme: "custom" }));
  }, []);

  const setColorSurface = useCallback((colorSurface: string | null) => {
    setTheme((t) => ({ ...t, colorSurface, scheme: "custom" }));
  }, []);

  const value = useMemo(
    () => ({
      ...theme,
      setMode,
      setAccent,
      setCustomAccent,
      applyScheme,
      setTransparency,
      setBlur,
      setRadius,
      setColorBg,
      setColorSurface,
    }),
    [
      theme,
      setMode,
      setAccent,
      setCustomAccent,
      applyScheme,
      setTransparency,
      setBlur,
      setRadius,
      setColorBg,
      setColorSurface,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside provider");
  return ctx;
}
