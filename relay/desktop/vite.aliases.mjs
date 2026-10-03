import path from "node:path";

/**
 * Shared aliases for the desktop Vite app → web `relay/src` tree.
 * Keep in sync with `desktop/tsconfig.json` `compilerOptions.paths`.
 * Vite does not read tsconfig paths; a missing entry here is a runtime failure.
 */
export function relayDesktopAliases(fromDir) {
  const shared = path.resolve(fromDir, "../src");
  return {
    "@": path.resolve(fromDir, "src"),
    "@relay-messages": path.resolve(fromDir, "../messages"),
    "@relay-i18n": path.resolve(shared, "i18n"),
    "@relay-board": path.resolve(shared, "lib/board"),
    "@relay-board-chrome": path.resolve(shared, "components/BoardChrome.tsx"),
    "@relay-help": path.resolve(shared, "components/BoardHelp.tsx"),
    "@relay-activity": path.resolve(shared, "components/ActivityDisclosure.tsx"),
    "@relay-search": path.resolve(shared, "components/SearchPalette.tsx"),
    "@relay-history": path.resolve(shared, "components/VersionHistory.tsx"),
    "@relay-mode-switch": path.resolve(shared, "components/ContentModeSwitch.tsx"),
    "@relay-activity-refresh": path.resolve(shared, "lib/activity-refresh.ts"),
    "@relay-account": path.resolve(shared, "components/AccountSettings.tsx"),
    "@relay-avatar": path.resolve(shared, "components/UserAvatar.tsx"),
    "@relay-editor-focus": path.resolve(shared, "editor/activity-focus.ts"),
  };
}
