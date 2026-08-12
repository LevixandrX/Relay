import type { AppLocale } from "./config";

/**
 * Prefer Russian only when the OS/browser list includes a `ru*` tag.
 * Any other preferred language (en, de, fr, …) → English.
 * Used when the user has not saved an explicit locale yet.
 */
export function localeFromLanguageTags(
  tags: readonly string[] | string | null | undefined,
): AppLocale {
  const list = normalizeTags(tags);
  for (const tag of list) {
    if (tag === "ru" || tag.startsWith("ru-")) return "ru";
  }
  return "en";
}

/** Parse `Accept-Language` header (q-values ignored; order is preference). */
export function localeFromAcceptLanguage(header: string | null | undefined): AppLocale {
  if (!header?.trim()) return "en";
  const tags = header.split(",").map((part) => part.trim().split(";")[0]?.trim() ?? "");
  return localeFromLanguageTags(tags);
}

function normalizeTags(tags: readonly string[] | string | null | undefined): string[] {
  if (!tags) return [];
  const raw = typeof tags === "string" ? [tags] : [...tags];
  return raw.map((t) => t.trim().toLowerCase()).filter(Boolean);
}
