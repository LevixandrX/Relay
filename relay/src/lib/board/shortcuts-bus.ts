export const SHORTCUTS_TOGGLE = "relay:shortcuts-toggle";

export function toggleBoardShortcuts() {
  window.dispatchEvent(new Event(SHORTCUTS_TOGGLE));
}
