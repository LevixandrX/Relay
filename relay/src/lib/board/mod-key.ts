import { useSyncExternalStore } from "react";

/** True on Apple OS — where the modifier key is ⌘, not Ctrl. */
export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X|Macintosh/.test(ua);
}

const noSubscribe = () => () => {};

/**
 * Modifier label for shortcut copy. Server and first paint use Ctrl so Windows
 * never hydrates a ⌘ that isn't there; Apple clients correct after mount.
 */
export function useModLabel() {
  return useSyncExternalStore(
    noSubscribe,
    () => (isApplePlatform() ? "\u2318" : "Ctrl"),
    () => "Ctrl",
  );
}

export function shortcutHint(mod: string, key: string) {
  return `${mod} ${key}`;
}
