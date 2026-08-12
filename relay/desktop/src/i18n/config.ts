export const locales = ["ru", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "ru" || value === "en";
}

export function normalizeLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
