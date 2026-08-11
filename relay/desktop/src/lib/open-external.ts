/**
 * Opens a URL in the user's real browser. Inside Tauri the webview cannot host
 * Google's consent screen, so we hand off to the OS; in `vite dev` we fall back
 * to a normal tab.
 */
export async function openExternal(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Некорректная ссылка");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Разрешены только http(s) ссылки");
  }

  const isTauri = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
  if (isTauri) {
    const { openUrl, open } = (await import("@tauri-apps/plugin-shell")) as unknown as {
      openUrl?: (url: string) => Promise<void>;
      open?: (url: string) => Promise<void>;
    };
    const fn = openUrl ?? open;
    if (fn) {
      await fn(parsed.toString());
      return;
    }
  }
  window.open(parsed.toString(), "_blank", "noopener,noreferrer");
}
