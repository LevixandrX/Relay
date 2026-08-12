export const locales = ["ru", "en"] as const;
export type AppLocale = (typeof locales)[number];

/** Fallback when nothing else applies — non-Russian world defaults to English. */
export const defaultLocale: AppLocale = "en";
export const localeCookieName = "relay-locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "ru" || value === "en";
}

export function normalizeLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
