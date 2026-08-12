import type { AppLocale } from "./config";

/** Same policy as web: ru* → ru, otherwise en. */
export function localeFromLanguageTags(
  tags: readonly string[] | string | null | undefined,
): AppLocale {
  const list = normalizeTags(tags);
  for (const tag of list) {
    if (tag === "ru" || tag.startsWith("ru-")) return "ru";
  }
  return "en";
}

export function localeFromNavigator(): AppLocale {
  if (typeof navigator === "undefined") return "en";
  const tags =
    navigator.languages?.length ? navigator.languages : [navigator.language || "en"];
  return localeFromLanguageTags(tags);
}

function normalizeTags(tags: readonly string[] | string | null | undefined): string[] {
  if (!tags) return [];
  const raw = typeof tags === "string" ? [tags] : [...tags];
  return raw.map((t) => t.trim().toLowerCase()).filter(Boolean);
}
