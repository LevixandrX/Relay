import type { Editor } from "@quickdrawjs/core";
import { pageBounds } from "@quickdrawjs/core";

/** Must match patch-quickdraw.mjs ZOOM_MAX. */
export const BOARD_ZOOM_MIN = 0.05;
export const BOARD_ZOOM_MAX = 32;

export type BoardRect = { x: number; y: number; w: number; h: number };

export type MinimapTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  world: BoardRect;
};

export function clampZoom(z: number) {
  return Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, z));
}

export function formatZoom(z: number) {
  return `${Math.round(z * 100)}%`;
}

export function parseZoomInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/%/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampZoom(n / 100);
}

function unionRect(a: BoardRect, b: BoardRect, pad = 0): BoardRect {
  const x = Math.min(a.x, b.x) - pad;
  const y = Math.min(a.y, b.y) - pad;
  const x2 = Math.max(a.x + a.w, b.x + b.w) + pad;
  const y2 = Math.max(a.y + a.h, b.y + b.h) + pad;
  return { x, y, w: x2 - x, h: y2 - y };
}

export function navigatorWorld(editor: Editor): BoardRect {
  const vp = editor.viewportPageBounds();
  const content = editor.contentBounds();
  if (!content || content.w <= 0 || content.h <= 0) {
    const pad = Math.max(240, Math.max(vp.w, vp.h) * 0.35);
    return unionRect(vp, { x: vp.x - pad, y: vp.y - pad, w: pad * 2, h: pad * 2 }, 0);
  }
  return unionRect(content, vp, Math.max(48, Math.min(content.w, content.h) * 0.08));
}

export function minimapTransform(world: BoardRect, mapW: number, mapH: number, pad = 6): MinimapTransform {
  const innerW = Math.max(1, mapW - pad * 2);
  const innerH = Math.max(1, mapH - pad * 2);
  const scale = Math.min(innerW / world.w, innerH / world.h);
  const drawW = world.w * scale;
  const drawH = world.h * scale;
  const offsetX = pad + (innerW - drawW) / 2 - world.x * scale;
  const offsetY = pad + (innerH - drawH) / 2 - world.y * scale;
  return { scale, offsetX, offsetY, world };
}

export function worldToMinimap(t: MinimapTransform, wx: number, wy: number) {
  return { x: wx * t.scale + t.offsetX, y: wy * t.scale + t.offsetY };
}

export function minimapToWorld(t: MinimapTransform, mx: number, my: number) {
  return { x: (mx - t.offsetX) / t.scale, y: (my - t.offsetY) / t.scale };
}

export function viewportMinimapRect(editor: Editor, t: MinimapTransform): BoardRect {
  const vp = editor.viewportPageBounds();
  const tl = worldToMinimap(t, vp.x, vp.y);
  const br = worldToMinimap(t, vp.x + vp.w, vp.y + vp.h);
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

export function centerCameraOn(editor: Editor, wx: number, wy: number, animate = 90) {
  const { w, h } = editor.viewSize();
  const z = editor.camera.z;
  editor.setCamera({ z, x: w / 2 / z - wx, y: h / 2 / z - wy }, { animate });
}

export function setZoomLevel(editor: Editor, z: number, animate = 120) {
  const next = clampZoom(z);
  const { w, h } = editor.viewSize();
  editor.zoomAt(w / 2, h / 2, next / editor.camera.z, { animate });
}

export function zoomIn(editor: Editor) {
  const { w, h } = editor.viewSize();
  editor.zoomAt(w / 2, h / 2, 1.2, { animate: 120 });
}

export function zoomOut(editor: Editor) {
  const { w, h } = editor.viewSize();
  editor.zoomAt(w / 2, h / 2, 1 / 1.2, { animate: 120 });
}

export function zoomReset(editor: Editor) {
  setZoomLevel(editor, 1, 180);
}

export function zoomFit(editor: Editor) {
  editor.fitContent({ animate: 220, maxZoom: 2 });
}

const SHAPE_TINT: Record<string, string> = {
  draw: "#64748b",
  highlight: "#fbbf24",
  geo: "#6366f1",
  arrow: "#0ea5e9",
  line: "#0ea5e9",
  text: "#334155",
  note: "#f59e0b",
  image: "#94a3b8",
};

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  editor: Editor,
  mapW: number,
  mapH: number,
  dark: boolean,
) {
  const world = navigatorWorld(editor);
  const t = minimapTransform(world, mapW, mapH, 8);

  ctx.clearRect(0, 0, mapW, mapH);

  const bg = ctx.createLinearGradient(0, 0, 0, mapH);
  bg.addColorStop(0, dark ? "#1a1f28" : "#f4f6fa");
  bg.addColorStop(1, dark ? "#12161d" : "#e9edf4");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, mapW, mapH);

  ctx.strokeStyle = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  const step = 10;
  for (let x = 0; x < mapW; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, mapH);
    ctx.stroke();
  }
  for (let y = 0; y < mapH; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(mapW, y + 0.5);
    ctx.stroke();
  }

  const frameTl = worldToMinimap(t, world.x, world.y);
  const frameBr = worldToMinimap(t, world.x + world.w, world.y + world.h);
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  ctx.strokeRect(frameTl.x, frameTl.y, frameBr.x - frameTl.x, frameBr.y - frameTl.y);

  for (const shape of editor.store.shapes()) {
    const b = pageBounds(shape);
    if (!b || b.w <= 0 || b.h <= 0) continue;
    const p = worldToMinimap(t, b.x, b.y);
    const q = worldToMinimap(t, b.x + b.w, b.y + b.h);
    ctx.fillStyle = SHAPE_TINT[shape.type] ?? (dark ? "#8b9cb3" : "#64748b");
    ctx.globalAlpha = shape.type === "highlight" ? 0.5 : 0.9;
    const rw = Math.max(2, q.x - p.x);
    const rh = Math.max(2, q.y - p.y);
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, rw, rh, 1);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const vp = viewportMinimapRect(editor, t);
  ctx.fillStyle = dark ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.12)";
  ctx.beginPath();
  ctx.roundRect(vp.x, vp.y, Math.max(6, vp.w), Math.max(6, vp.h), 2);
  ctx.fill();
  ctx.strokeStyle = dark ? "rgba(165,180,252,0.95)" : "rgba(79,70,229,0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
