/**
 * @quickdrawjs/core@0.2.0 ships editor.js without importing FONTS (text tool crash).
 * Patch local installs after npm install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PALETTE_MARK = "Relay canvas v2";
const PALETTE_TARGETS = [
  path.join(here, "..", "node_modules", "@quickdrawjs", "core", "src", "palette.js"),
  path.join(here, "..", "desktop", "node_modules", "@quickdrawjs", "core", "src", "palette.js"),
];

function patchPalette(file) {
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes(PALETTE_MARK)) return;
  const next = src
    .replace("background: '#e6ebf4', // Relay canvas", `background: '#ececec', // ${PALETTE_MARK}`)
    .replace("background: '#10131a', // Relay canvas", `background: '#141414', // ${PALETTE_MARK}`)
    .replace("background: '#fbf9f4', // warm paper", `background: '#ececec', // ${PALETTE_MARK}`)
    .replace("background: '#191713',", `background: '#141414', // ${PALETTE_MARK}`)
    .replace("handleFill: '#1b2130',", "handleFill: '#242424',")
    .replace("handleFill: '#26231c',", "handleFill: '#242424',")
    .replace(
      "line: { minor: 'rgba(11, 18, 32, 0.055)', major: 'rgba(11, 18, 32, 0.11)' },\n      dot: { minor: 'rgba(11, 18, 32, 0.16)', major: 'rgba(11, 18, 32, 0.28)' },",
      "line: { minor: 'rgba(0, 0, 0, 0.05)', major: 'rgba(0, 0, 0, 0.10)' },\n      dot: { minor: 'rgba(0, 0, 0, 0.14)', major: 'rgba(0, 0, 0, 0.24)' },",
    )
    .replace(
      "line: { minor: 'rgba(238, 242, 255, 0.045)', major: 'rgba(238, 242, 255, 0.09)' },\n      dot: { minor: 'rgba(238, 242, 255, 0.12)', major: 'rgba(238, 242, 255, 0.22)' },",
      "line: { minor: 'rgba(255, 255, 255, 0.045)', major: 'rgba(255, 255, 255, 0.09)' },\n      dot: { minor: 'rgba(255, 255, 255, 0.12)', major: 'rgba(255, 255, 255, 0.22)' },",
    )
    .replace(
      "line: { minor: 'rgba(60, 50, 30, 0.13)', major: 'rgba(60, 50, 30, 0.26)' },\n      dot: { minor: 'rgba(60, 50, 30, 0.26)', major: 'rgba(60, 50, 30, 0.45)' },",
      "line: { minor: 'rgba(0, 0, 0, 0.05)', major: 'rgba(0, 0, 0, 0.10)' },\n      dot: { minor: 'rgba(0, 0, 0, 0.14)', major: 'rgba(0, 0, 0, 0.24)' },",
    )
    .replace(
      "line: { minor: 'rgba(255, 246, 224, 0.10)', major: 'rgba(255, 246, 224, 0.20)' },\n      dot: { minor: 'rgba(255, 246, 224, 0.20)', major: 'rgba(255, 246, 224, 0.36)' },",
      "line: { minor: 'rgba(255, 255, 255, 0.045)', major: 'rgba(255, 255, 255, 0.09)' },\n      dot: { minor: 'rgba(255, 255, 255, 0.12)', major: 'rgba(255, 255, 255, 0.22)' },",
    );
  if (next === src) {
    console.warn(`[relay] palette patch missed ${path.relative(process.cwd(), file)}`);
    return;
  }
  fs.writeFileSync(file, next);
  console.log(`[relay] patched ${path.relative(process.cwd(), file)}`);
}

for (const file of PALETTE_TARGETS) patchPalette(file);

const targets = [
  path.join(here, "..", "node_modules", "@quickdrawjs", "core", "src", "editor.js"),
  path.join(here, "..", "desktop", "node_modules", "@quickdrawjs", "core", "src", "editor.js"),
];

const IMPORT =
  "import { themeOf, SIZES, FONT_SIZES, GEO_IDS, COLOR_IDS, GRID_IDS, GRID_STEP, GRID_MAJOR } from './palette.js'";
const IMPORT_FIXED =
  "import { themeOf, SIZES, FONT_SIZES, FONTS, GEO_IDS, COLOR_IDS, GRID_IDS, GRID_STEP, GRID_MAJOR } from './palette.js'";

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  let changed = false;

  if (src.includes(IMPORT) && !src.includes("FONTS, GEO_IDS")) {
    src = src.replace(IMPORT, IMPORT_FIXED);
    changed = true;
  }

  if (src.includes("const ZOOM_MAX = 8")) {
    src = src.replace("const ZOOM_MAX = 8", "const ZOOM_MAX = 32");
    changed = true;
  }

  const WHEEL_READONLY =
    "  _wheel(e) {\n    if (this.readonly) return\n    e.preventDefault()";
  const WHEEL_FIXED = "  _wheel(e) {\n    e.preventDefault()";
  const WHEEL_RELAY =
    "  _wheel(e) {\n    // Relay useBoardWheel owns wheel routing\n    e.preventDefault()";
  if (src.includes(WHEEL_READONLY)) {
    src = src.replace(WHEEL_READONLY, WHEEL_RELAY);
    changed = true;
  } else if (src.includes(WHEEL_FIXED) && !src.includes("Relay useBoardWheel")) {
    src = src.replace(WHEEL_FIXED, WHEEL_RELAY);
    changed = true;
  }

  const WHEEL_BIND = "c.addEventListener('wheel', this._onWheel, { passive: false })";
  const WHEEL_BIND_OFF = "// Relay: wheel routed in useBoardViewportInput\n    // c.addEventListener('wheel', this._onWheel, { passive: false })";
  if (src.includes(WHEEL_BIND) && !src.includes("useBoardViewportInput")) {
    src = src.replace(WHEEL_BIND, WHEEL_BIND_OFF);
    changed = true;
  }

  const KEY_MARK = "Relay physical keys";
  if (!src.includes(KEY_MARK)) {
    const before = src;
    src = src.replace(
      `    const k = e.key.toLowerCase()\n    if (k === ' ') {`,
      `    const k = e.key.toLowerCase()\n    // ${KEY_MARK}\n    const phys = e.code.startsWith('Key') && e.code.length === 4 ? e.code.slice(3).toLowerCase() : ''\n    const digit = e.code.startsWith('Digit') ? e.code.slice(5) : (e.code.match(/^Numpad(\\d)$/) ? e.code.slice(6) : '')\n    const hit = (letter) => phys === letter || k === letter\n    if (k === ' ' || e.code === 'Space') {`,
    );
    src = src.replace(`if (meta && k === 'z')`, `if (meta && hit('z'))`);
    src = src.replace(`if (meta && k === 'a')`, `if (meta && hit('a'))`);
    src = src.replace(`if (meta && k === 'd')`, `if (meta && hit('d'))`);
    src = src.replace(`if (meta && k === 'c')`, `if (meta && hit('c'))`);
    src = src.replace(`if (meta && k === 'x')`, `if (meta && hit('x'))`);
    src = src.replace(`if (meta && k === 'v')`, `if (meta && hit('v'))`);
    src = src.replace(
      `if (meta && (k === '=' || k === '+'))`,
      `if (meta && (k === '=' || k === '+' || e.code === 'Equal' || e.code === 'NumpadAdd'))`,
    );
    src = src.replace(
      `if (meta && k === '-')`,
      `if (meta && (k === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract'))`,
    );
    src = src.replace(
      `if (k === ']') { this.bringToFront(); return }\n      if (k === '[') { this.sendToBack(); return }`,
      `if (k === ']' || e.code === 'BracketRight') { this.bringToFront(); return }\n      if (k === '[' || e.code === 'BracketLeft') { this.sendToBack(); return }`,
    );
    src = src.replace(
      `      if (toolKeys[k]) { this.setTool(toolKeys[k]); return }\n      const geoKeys = { r: 'rectangle', o: 'ellipse' }\n      if (geoKeys[k]) { this.setGeoKind(geoKeys[k]); this.setTool('geo'); return }\n      if (e.shiftKey && k === '!') { this.fitContent({ animate: 220 }); return }\n    }\n    if (e.shiftKey && k === '1') { this.fitContent({ animate: 220 }); return }\n    if (e.shiftKey && k === '0') {`,
      `      const tool = toolKeys[phys] || toolKeys[k] || toolKeys[digit]\n      if (tool) { this.setTool(tool); return }\n      const geoKeys = { r: 'rectangle', o: 'ellipse' }\n      const geo = geoKeys[phys] || geoKeys[k]\n      if (geo) { this.setGeoKind(geo); this.setTool('geo'); return }\n    }\n    if (e.shiftKey && !meta && (digit === '1' || k === '1' || k === '!')) { this.fitContent({ animate: 220 }); return }\n    if (e.shiftKey && !meta && (digit === '0' || k === '0' || k === ')')) {`,
    );
    if (src !== before) changed = true;
    else console.warn(`[relay] keyboard patch missed ${path.relative(process.cwd(), file)}`);
  }

  if (changed) {
    fs.writeFileSync(file, src);
    console.log(`[relay] patched ${path.relative(process.cwd(), file)}`);
  }
}
