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
  loadTheme,
  saveTheme,
  type AccentId,
  type ThemeMode,
  type ThemeState,
} from "./tokens";

type ThemeContextValue = ThemeState & {
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  setCustomAccent: (hex: string) => void;
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
    setTheme((t) => ({ ...t, mode }));
  }, []);

  const setAccent = useCallback((accent: AccentId) => {
    setTheme((t) => ({ ...t, accent }));
  }, []);

  const setCustomAccent = useCallback((customAccent: string) => {
    setTheme((t) => ({ ...t, accent: "custom", customAccent }));
  }, []);

  const value = useMemo(
    () => ({ ...theme, setMode, setAccent, setCustomAccent }),
    [theme, setMode, setAccent, setCustomAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside provider");
  return ctx;
}
