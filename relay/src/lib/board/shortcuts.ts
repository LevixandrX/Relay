/**
 * Source of truth for the canvas key map.
 *
 * Every combo here exists in the code we ship: tool/edit keys come from
 * Quickdraw's `_keyDown` (@quickdrawjs/core/src/editor.js), wheel and hold-zoom
 * from `useBoardViewportInput`, the rest from the Relay shell. Nothing is
 * aspirational — if a key is listed, pressing it does something today.
 */

export type ShortcutKey = { label: string; wide?: boolean };

export type ShortcutRow = {
  /** i18n key inside the `help` namespace */
  label: string;
  keys: ShortcutKey[];
};

export type ShortcutGroup = {
  title: string;
  rows: ShortcutRow[];
};

const MOD = "\u0000mod";
const SHIFT = "\u0000shift";

function k(label: string, wide?: boolean): ShortcutKey {
  return wide ? { label, wide: true } : { label };
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "groupNavigate",
    rows: [
      { label: "panWheel", keys: [k("keyScroll", true)] },
      { label: "zoomWheel", keys: [k(MOD), k("keyScroll", true)] },
      { label: "panSpace", keys: [k("keySpace", true), k("keyDrag", true)] },
      { label: "zoomIn", keys: [k(MOD), k("+")] },
      { label: "zoomOut", keys: [k(MOD), k("−")] },
      { label: "zoomFit", keys: [k(SHIFT, true), k("1")] },
      { label: "zoomReset", keys: [k(SHIFT, true), k("0")] },
    ],
  },
  {
    title: "groupTools",
    rows: [
      { label: "toolSelect", keys: [k("V")] },
      { label: "toolHand", keys: [k("H")] },
      { label: "toolDraw", keys: [k("D")] },
      { label: "toolHighlight", keys: [k("I")] },
      { label: "toolEraser", keys: [k("E")] },
      { label: "toolLaser", keys: [k("K")] },
      { label: "toolLine", keys: [k("L")] },
      { label: "toolArrow", keys: [k("A")] },
      { label: "toolGeo", keys: [k("G")] },
      { label: "toolRect", keys: [k("R")] },
      { label: "toolEllipse", keys: [k("O")] },
      { label: "toolText", keys: [k("T")] },
      { label: "toolNote", keys: [k("N")] },
    ],
  },
  {
    title: "groupEdit",
    rows: [
      { label: "undo", keys: [k(MOD), k("Z")] },
      { label: "redo", keys: [k(MOD), k(SHIFT, true), k("Z")] },
      { label: "selectAll", keys: [k(MOD), k("A")] },
      { label: "duplicate", keys: [k(MOD), k("D")] },
      { label: "copy", keys: [k(MOD), k("C")] },
      { label: "cut", keys: [k(MOD), k("X")] },
      { label: "paste", keys: [k(MOD), k("V")] },
      { label: "editText", keys: [k("Enter", true)] },
      { label: "nudge", keys: [k("↑ ↓ ← →", true)] },
      { label: "nudgeFar", keys: [k(SHIFT, true), k("↑ ↓ ← →", true)] },
      { label: "toFront", keys: [k("]")] },
      { label: "toBack", keys: [k("[")] },
      { label: "deleteShapes", keys: [k("keyDel", true)] },
      { label: "clearBoard", keys: [k(MOD), k(SHIFT, true), k("keyDel", true)] },
      { label: "cancel", keys: [k("Esc", true)] },
    ],
  },
  {
    title: "groupApp",
    rows: [
      { label: "helpOpen", keys: [k("F1", true)] },
      { label: "search", keys: [k(MOD), k("K")] },
    ],
  },
];

/**
 * Resolves the placeholders that depend on platform or locale.
 * `t` translates the `help` namespace; labels that are not keys pass through.
 */
export function shortcutGroups(t: (key: string) => string, mod: string): ShortcutGroup[] {
  const shift = t("keyShift");
  const resolve = (label: string) => {
    if (label === MOD) return mod;
    if (label === SHIFT) return shift;
    if (/^key[A-Z]/.test(label)) return t(label);
    return label;
  };
  return GROUPS.map((group) => ({
    title: group.title,
    rows: group.rows.map((row) => ({
      label: row.label,
      keys: row.keys.map((key) => ({ ...key, label: resolve(key.label) })),
    })),
  }));
}
