function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }

export function parseHex(raw: string): string | null {
  const s = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s.split("").map((c) => c + c).join("").toLowerCase()}`;
  }
  return null;
}

export function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexIsDark(hex: string) {
  const parsed = parseHex(hex);
  if (!parsed) return true;
  const { r, g, b } = hexToRgb(parsed);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.45;
}

export function hexToHsl(hex: string) {
  let { r, g, b } = hexToRgb(hex);
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const lit = l / 100;
  const a = sat * Math.min(lit, 1 - lit);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lit - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c);
  };
  return rgbToHex(f(0), f(8), f(4));
}

export function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round((max / 255) * 100) };
}

export function hsvToHex(h: number, s: number, v: number) {
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(v, 0, 100) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

