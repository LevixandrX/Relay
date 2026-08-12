import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { IntlProvider } from "use-intl";
import type { AppLocale } from "./config";
import { normalizeLocale } from "./config";
import { localeFromNavigator } from "./detectLocale";
import ru from "../../../messages/ru.json";
import en from "../../../messages/en.json";

const STORAGE_KEY = "relay-desktop-locale";

const catalogs: Record<AppLocale, typeof ru> = { ru, en };

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function loadLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeLocale(saved);
  } catch {
    /* ignore */
  }
  return localeFromNavigator();
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => loadLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    const normalized = normalizeLocale(next);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }
    setLocaleState(normalized);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} messages={catalogs[locale]}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useAppLocale outside provider");
  return ctx;
}
