import type { Editor } from "@quickdrawjs/core";
import { THEMES } from "@quickdrawjs/core";

/**
 * Quickdraw ships a warm “paper” backdrop. Relay chrome is neutral gray —
 * keep the lattice, drop the brown and the navy.
 * Hexes must stay in sync with `--canvas` in globals / desktop CSS.
 *
 * Write onto the live editor too: desktop Vite can load two copies of
 * @quickdrawjs/core, so mutating THEMES in this module may not reach the engine.
 */
const LIGHT = {
  background: "#ececec",
  handleFill: "#ffffff",
  grid: {
    line: { minor: "rgba(0, 0, 0, 0.05)", major: "rgba(0, 0, 0, 0.1)" },
    dot: { minor: "rgba(0, 0, 0, 0.14)", major: "rgba(0, 0, 0, 0.24)" },
  },
};

const DARK = {
  background: "#141414",
  handleFill: "#242424",
  grid: {
    line: { minor: "rgba(255, 255, 255, 0.045)", major: "rgba(255, 255, 255, 0.09)" },
    dot: { minor: "rgba(255, 255, 255, 0.12)", major: "rgba(255, 255, 255, 0.22)" },
  },
};

function spec(mode: "light" | "dark") {
  return mode === "dark" ? DARK : LIGHT;
}

export function applyRelayBoardTheme() {
  THEMES.light.background = LIGHT.background;
  THEMES.light.handleFill = LIGHT.handleFill;
  THEMES.light.grid = LIGHT.grid;
  THEMES.dark.background = DARK.background;
  THEMES.dark.handleFill = DARK.handleFill;
  THEMES.dark.grid = DARK.grid;
}

function paintCanvasForBackdrop(canvas: HTMLCanvasElement) {
  canvas.style.backgroundImage = "linear-gradient(transparent, transparent)";
  canvas.style.transform = "none";
  canvas.style.translate = "none";
  canvas.style.willChange = "auto";
  canvas.style.isolation = "auto";
  canvas.style.opacity = "1";
}

export function enableCanvasBackdropSampling(root: ParentNode | null | undefined) {
  if (!root || !("querySelectorAll" in root)) return;
  root.querySelectorAll("canvas").forEach((node) => {
    paintCanvasForBackdrop(node as HTMLCanvasElement);
  });
}

/** Keep new Quickdraw canvases on the HTML paint path so chrome can blur them. */
export function watchCanvasBackdropSampling(root: ParentNode | null | undefined) {
  if (!root) return () => undefined;
  enableCanvasBackdropSampling(root);
  const mo = new MutationObserver(() => enableCanvasBackdropSampling(root));
  mo.observe(root, { childList: true, subtree: true });
  return () => mo.disconnect();
}

export function paintEditorCanvas(editor: Editor, mode: "light" | "dark") {
  applyRelayBoardTheme();
  const next = spec(mode);
  editor.theme.background = next.background;
  editor.theme.handleFill = next.handleFill;
  editor.theme.grid = next.grid;
  editor.container.style.background = next.background;
  enableCanvasBackdropSampling(editor.container);
  const paint = editor as Editor & { requestRender?: () => void };
  paint.requestRender?.();
}
