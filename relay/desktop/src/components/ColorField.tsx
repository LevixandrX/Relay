import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  hexToHsl,
  hexToHsv,
  hexToRgb,
  hslToHex,
  hsvToHex,
  parseHex,
  rgbToHex,
} from "../theme/tokens";

type Mode = "hex" | "rgb" | "hsl";

const OPEN_EVENT = "relay:color-field";
const POP_W = 264;
const SV_H = 136;
const POP_CHROME = 148;

export function ColorField({
  label,
  hint,
  value,
  fallback,
  resetLabel,
  hexLabel,
  rgbLabel,
  hslLabel,
  pickLabel,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  fallback: string;
  resetLabel: string;
  hexLabel: string;
  rgbLabel: string;
  hslLabel: string;
  pickLabel: string;
  onChange: (hex: string | null) => void;
}) {
  const hex = value ?? fallback;
  const hsv = hexToHsv(hex);
  const rgb = hexToRgb(hex);
  const hsl = hexToHsl(hex);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("hex");
  const [draft, setDraft] = useState(hex);
  const [pos, setPos] = useState({ top: 0, left: 0, sv: SV_H });
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    setDraft(hex);
  }, [hex]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = rootRef.current?.querySelector(".color-swatch") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      const gap = 8;
      let left = r.left;
      if (left + POP_W > window.innerWidth - margin) left = window.innerWidth - POP_W - margin;
      if (left < margin) left = margin;

      let sv = SV_H;
      let popH = POP_CHROME + sv;
      const maxH = window.innerHeight - margin * 2;
      if (popH > maxH) {
        sv = Math.max(96, maxH - POP_CHROME);
        popH = POP_CHROME + sv;
      }

      let top = r.bottom + gap;
      if (top + popH > window.innerHeight - margin) {
        const above = r.top - gap - popH;
        top = above >= margin ? above : Math.max(margin, window.innerHeight - popH - margin);
      }
      setPos({ top, left, sv });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: popId }));
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== popId) setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOther);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOther);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, popId]);

  function commitHex(raw: string) {
    const parsed = parseHex(raw);
    if (parsed) onChange(parsed);
    else setDraft(hex);
  }

  function pickSv(e: React.PointerEvent<HTMLDivElement>) {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100);
    const v = Math.round(Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)) * 100);
    onChange(hsvToHex(hsv.h, s, v));
  }

  function dragSv(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pickSv(e);
  }

  const picker = open
    ? createPortal(
        <div
          ref={popRef}
          className="color-pop"
          id={popId}
          role="dialog"
          aria-label={label}
          style={{ top: pos.top, left: pos.left, ["--sv-h" as string]: `${pos.sv}px` }}
        >
          <div
            ref={svRef}
            className="color-sv"
            style={{ backgroundColor: hsvToHex(hsv.h, 100, 100) }}
            onPointerDown={dragSv}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) pickSv(e);
            }}
          >
            <span
              className="color-sv-thumb"
              style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
            />
          </div>
          <div className="color-hue-row">
            <input
              type="range"
              className="color-hue"
              min={0}
              max={360}
              value={hsv.h}
              aria-label={hslLabel}
              onChange={(e) => onChange(hsvToHex(Number(e.target.value), hsv.s, hsv.v))}
            />
            {typeof window !== "undefined" && "EyeDropper" in window ? (
              <button
                type="button"
                className="color-drop"
                aria-label={pickLabel}
                onClick={() => {
                  void (async () => {
                    try {
                      const Eye = (
                        window as unknown as {
                          EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
                        }
                      ).EyeDropper;
                      const { sRGBHex } = await new Eye().open();
                      const parsed = parseHex(sRGBHex);
                      if (parsed) onChange(parsed);
                    } catch {
                      /* cancelled */
                    }
                  })();
                }}
              >
                <DropIcon />
              </button>
            ) : null}
          </div>
          <div className="color-mode" role="tablist" aria-label={hexLabel}>
            {(
              [
                ["hex", hexLabel],
                ["rgb", rgbLabel],
                ["hsl", hslLabel],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                data-active={mode === id}
                onClick={() => setMode(id)}
              >
                {name}
              </button>
            ))}
          </div>
          {mode === "hex" && (
            <input
              className="color-hex color-hex-full"
              value={draft}
              spellCheck={false}
              aria-label={hexLabel}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commitHex(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitHex(draft);
              }}
            />
          )}
          {mode === "rgb" && (
            <div className="color-nums">
              <Num label="R" max={255} value={rgb.r} onChange={(n) => onChange(rgbToHex(n, rgb.g, rgb.b))} />
              <Num label="G" max={255} value={rgb.g} onChange={(n) => onChange(rgbToHex(rgb.r, n, rgb.b))} />
              <Num label="B" max={255} value={rgb.b} onChange={(n) => onChange(rgbToHex(rgb.r, rgb.g, n))} />
            </div>
          )}
          {mode === "hsl" && (
            <div className="color-nums">
              <Num label="H" max={360} value={hsl.h} onChange={(n) => onChange(hslToHex(n, hsl.s, hsl.l))} />
              <Num label="S" max={100} value={hsl.s} onChange={(n) => onChange(hslToHex(hsl.h, n, hsl.l))} />
              <Num label="L" max={100} value={hsl.l} onChange={(n) => onChange(hslToHex(hsl.h, hsl.s, n))} />
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="color-field" ref={rootRef}>
      <div className="color-slot-head">
        <span>{label}</span>
        <span className="muted">{hint}</span>
      </div>
      <div className="color-field-row">
        <button
          type="button"
          className="color-swatch"
          data-active={open || Boolean(value)}
          style={{ background: hex }}
          aria-expanded={open}
          aria-controls={popId}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
        />
        <input
          className="color-hex"
          value={draft}
          spellCheck={false}
          aria-label={hexLabel}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitHex(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex(draft);
          }}
        />
        {value ? (
          <button type="button" className="color-reset" onClick={() => onChange(null)}>
            {resetLabel}
          </button>
        ) : null}
      </div>
      {picker}
    </div>
  );
}

function Num({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="color-num">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
      />
    </label>
  );
}

function DropIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.2 14.8 14.8 5.2l4 4-9.6 9.6H5.2v-4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m12.8 7.2 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
