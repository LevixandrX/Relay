"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import "@/app/landing.css";

function useInView(idleAfterMs = 4000) {
  const ref = useRef<HTMLElement | null>(null);
  const [play, setPlay] = useState(false);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let armed = false;
    let t: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      if (armed) return;
      armed = true;
      setPlay(true);
      t = setTimeout(() => setIdle(true), idleAfterMs);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) arm();
      },
      { threshold: [0, 0.08, 0.15], rootMargin: "12% 0px -8% 0px" },
    );
    io.observe(el);

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    if (r.top < vh * 0.92 && r.bottom > vh * 0.08) arm();

    return () => {
      io.disconnect();
      if (t) clearTimeout(t);
    };
  }, [idleAfterMs]);

  return { ref, play, idle };
}

function Stage({
  id,
  className = "",
  idleAfterMs,
  children,
}: {
  id?: string;
  className?: string;
  idleAfterMs?: number;
  children: ReactNode;
}) {
  const { ref, play, idle } = useInView(idleAfterMs);
  return (
    <section
      ref={ref}
      id={id}
      className={`ld-stage ${className}`}
      data-play={play ? "1" : "0"}
      data-idle={idle ? "1" : "0"}
    >
      {children}
    </section>
  );
}

function Panel({
  children,
  className = "",
  soft = true,
}: {
  children: ReactNode;
  className?: string;
  soft?: boolean;
}) {
  return (
    <div className={`ld-panel ${soft ? "ld-panel-soft" : "ld-panel-sharp"} ${className}`} aria-hidden>
      <div className="ld-panel-inner">{children}</div>
    </div>
  );
}

type FieldPhase = "hero" | "expand";

/** Dense SVG scene for hero→canvas morph (desktop only) */
function SharedFieldScene({ phase, armed }: { phase: FieldPhase; armed: boolean }) {
  const t = useTranslations("scene");
  return (
    <div className={`ld-scene-frame${armed ? " is-armed" : ""}`} data-phase={phase} aria-hidden>
      <svg className="ld-scene ld-scene-desktop" data-phase={phase} viewBox="0 0 640 520">
        {/* hero: to team/diagram/launch/metrics/note/prototype/AI — not sticky */}
        <g className="ld-scene-links ld-scene-links-hero">
          <path className="ld-sl ld-sl1" d="M225.9 229.8 L250.4 145.6" />
          <path className="ld-sl ld-sl2" d="M241.6 229.8 L363.3 115.6" />
          <path className="ld-sl ld-sl3" d="M258.1 229.8 L499.0 101.8" />
          <path className="ld-sl ld-sl4" d="M264.2 242.7 L509.0 202.6" />
          <path className="ld-sl ld-sl15" d="M264.2 261.3 L387.2 292.8" />
          <path className="ld-sl ld-sl5" d="M231.0 270.2 L302.5 401.2" />
          <path className="ld-sl ld-sl14" d="M207.5 270.2 L163.5 341.2" />
        </g>
        {/* expand: curved tree, no edge crossings */}
        <g className="ld-scene-links ld-scene-links-expand">
          <path className="ld-sl ld-sl6" d="M319.8 239.8 Q347.0 173.4 318.2 107.6" />
          <path className="ld-sl ld-sl7" d="M295.5 239.8 Q221.7 225.4 193.9 155.6" />
          <path className="ld-sl ld-sl8" d="M345.4 239.8 Q433.1 213.3 478.4 133.6" />
          <path className="ld-sl ld-sl9" d="M364.2 261.6 Q431.7 286.0 500.8 266.4" />
          <path className="ld-sl ld-sl10" d="M296.6 280.2 Q260.9 350.9 185.9 376.2" />
          <path className="ld-sl ld-sl17" d="M319.8 280.2 Q301.0 357.0 318.1 434.2" />
          <path className="ld-sl ld-sl20" d="M275.8 258.0 Q202.9 274.8 131.8 251.6" />
          <path className="ld-sl ld-sl11" d="M140.0 123.0 Q115.0 105.0 111.0 91.0" />
          <path className="ld-sl ld-sl12" d="M530.0 101.0 Q548.0 86.0 560.0 75.0" />
          <path className="ld-sl ld-sl13" d="M548.6 286.0 Q546.8 348.2 572.4 405.0" />
          <path className="ld-sl ld-sl18" d="M160.3 405.0 Q150.2 438.9 123.4 462.0" />
          <path className="ld-sl ld-sl19" d="M362.0 455.1 Q402.6 473.8 447.0 468.9" />
        </g>

        <g className="ld-scene-shapes ld-scene-shapes-hero">
          <path className="ld-ss ld-ss3" d="M275 48 L332 28 L320 88 Z" />
          <rect className="ld-ss ld-ss1" x="575" y="145" width="44" height="32" rx="8" />
          <ellipse className="ld-ss ld-ss2" cx="120" cy="445" rx="32" ry="20" />
          <rect className="ld-ss ld-ss4" x="455" y="430" width="52" height="36" rx="10" />
        </g>
        <g className="ld-scene-shapes ld-scene-shapes-expand">
          <path className="ld-ss ld-ss8" d="M395 40 L442 58 L408 95 Z" />
          <rect className="ld-ss ld-ss6" x="395" y="330" width="48" height="34" rx="8" />
          <rect className="ld-ss ld-ss1" x="220" y="175" width="36" height="28" rx="7" />
          <ellipse className="ld-ss ld-ss7" cx="95" cy="330" rx="26" ry="16" />
        </g>

        <g className="ld-sn ld-sn-core">
          <rect x="-48" y="-22" width="96" height="44" rx="22" />
          <text className="ld-sn-label-hero" y="1">
            {t("idea")}
          </text>
          <text className="ld-sn-label-expand" y="1">
            {t("thought")}
          </text>
        </g>

        <g className="ld-sn ld-sn-hero" transform="translate(255 130)">
          <rect x="-46" y="-17" width="92" height="34" rx="17" />
          <text y="1">{t("team")}</text>
        </g>
        <g className="ld-sn ld-sn-hero" transform="translate(380 100)">
          <rect x="-48" y="-17" width="96" height="34" rx="17" />
          <text y="1">{t("diagram")}</text>
        </g>
        <g className="ld-sn ld-sn-hero" transform="translate(525 88)">
          <rect x="-44" y="-15" width="88" height="30" rx="15" />
          <text y="1">{t("launch")}</text>
        </g>
        <g className="ld-sn ld-sn-hero" transform="translate(555 195)">
          <rect x="-50" y="-18" width="100" height="36" rx="18" />
          <text y="1">{t("metrics")}</text>
        </g>
        <g className="ld-sn ld-sn-hero" transform="translate(435 305)">
          <rect x="-52" y="-17" width="104" height="34" rx="17" />
          <text y="1">{t("note")}</text>
        </g>
        <g className="ld-sn ld-sn-hero" transform="translate(310 415)">
          <rect x="-54" y="-15" width="108" height="30" rx="15" />
          <text y="1">{t("prototype")}</text>
        </g>
        <g className="ld-sn ld-sn-hero ld-sn-ai" transform="translate(155 355)">
          <rect x="-30" y="-15" width="60" height="30" rx="15" />
          <text y="1">{t("ai")}</text>
        </g>
        <g className="ld-sn ld-sn-sticky ld-sn-hero" transform="translate(535 355) rotate(-3)">
          <rect x="-58" y="-20" width="116" height="40" rx="6" />
          <text y="1">{t("makeDemo")}</text>
        </g>

        <g className="ld-sn ld-sn-expand" transform="translate(318 92)">
          <rect x="-42" y="-17" width="84" height="34" rx="17" />
          <text y="1">{t("brief")}</text>
        </g>
        <g className="ld-sn ld-sn-expand" transform="translate(175 140)">
          <rect x="-68" y="-17" width="136" height="34" rx="17" />
          <text y="1">{t("research")}</text>
        </g>
        <g className="ld-sn ld-sn-expand" transform="translate(498 118)">
          <rect x="-52" y="-17" width="104" height="34" rx="17" />
          <text y="1">{t("prototype")}</text>
        </g>
        <g className="ld-sn ld-sn-expand" transform="translate(545 268)">
          <rect x="-48" y="-18" width="96" height="36" rx="18" />
          <text y="1">{t("launch")}</text>
        </g>
        <g className="ld-sn ld-sn-expand" transform="translate(170 390)">
          <rect x="-50" y="-15" width="100" height="30" rx="15" />
          <text y="1">{t("metrics")}</text>
        </g>
        <g className="ld-sn ld-sn-expand" transform="translate(318 448)">
          <rect x="-44" y="-15" width="88" height="30" rx="15" />
          <text y="1">{t("risks")}</text>
        </g>
        <g className="ld-sn ld-sn-expand ld-sn-outer" transform="translate(95 78)">
          <rect x="-32" y="-13" width="64" height="26" rx="13" />
          <text y="1">{t("poll")}</text>
        </g>
        <g className="ld-sn ld-sn-expand ld-sn-outer" transform="translate(575 62)">
          <rect x="-30" y="-13" width="60" height="26" rx="13" />
          <text y="1">{t("demo")}</text>
        </g>
        <g className="ld-sn ld-sn-expand ld-sn-outer" transform="translate(575 418)">
          <rect x="-32" y="-13" width="64" height="26" rx="13" />
          <text y="1">{t("release")}</text>
        </g>
        <g className="ld-sn ld-sn-expand ld-sn-outer" transform="translate(115 475)">
          <rect x="-40" y="-13" width="80" height="26" rx="13" />
          <text y="1">{t("retention")}</text>
        </g>
        <g className="ld-sn ld-sn-expand ld-sn-outer" transform="translate(485 475)">
          <rect x="-38" y="-13" width="76" height="26" rx="13" />
          <text y="1">{t("copy")}</text>
        </g>
        <g className="ld-sn ld-sn-expand ld-sn-outer" transform="translate(95 250)">
          <rect x="-40" y="-13" width="80" height="26" rx="13" />
          <text y="1">{t("design")}</text>
        </g>
      </svg>
    </div>
  );
}

/** Mobile hero — top/bottom bands only, never over text */
function MobileHeroDecor({ armed }: { armed: boolean }) {
  const t = useTranslations("scene");
  return (
    <>
      <div className={`ld-mdecor ld-mdecor-top${armed ? " is-armed" : ""}`} aria-hidden>
        <span className="ld-mchip ld-mh-a">{t("diagram")}</span>
        <span className="ld-mchip ld-mh-b ld-mchip-ai">{t("ai")}</span>
        <span className="ld-mchip ld-mh-far">{t("metrics")}</span>
        <span className="ld-mchip ld-mh-sticky">{t("makeDemo")}</span>
        <i className="ld-mshape ld-ms-tri" />
        <i className="ld-mshape ld-ms-oval ld-ms-oval-hero" />
      </div>
      <div className={`ld-mdecor ld-mdecor-bot${armed ? " is-armed" : ""}`} aria-hidden>
        <span className="ld-mchip ld-mh-c">{t("note")}</span>
        <span className="ld-mchip ld-mh-d">{t("prototype")}</span>
        <span className="ld-mchip ld-mh-e">{t("team")}</span>
        <span className="ld-mchip ld-mh-f ld-mchip-ai">{t("idea")}</span>
        <i className="ld-mshape ld-ms-box" />
        <i className="ld-mshape ld-ms-rect ld-ms-rect-hero" />
      </div>
    </>
  );
}

function MobPill({
  x,
  y,
  w,
  h,
  label,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tone?: "ai";
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={h / 2}
        className={tone === "ai" ? "ld-mpill ld-mpill-ai" : "ld-mpill"}
      />
      <text className={tone === "ai" ? "ld-mpill-t ld-mpill-t-ai" : "ld-mpill-t"}>{label}</text>
    </g>
  );
}

/** Mobile canvas — pure SVG; edge pills bleed past frame = no edges */
function MobileCanvasVisual({ armed }: { armed: boolean }) {
  const t = useTranslations("scene");
  const C = { x: 180, y: 200 };
  const nodes = {
    research: { x: 78, y: 78, w: 108, h: 32, label: t("researchShort") },
    proto: { x: 290, y: 70, w: 92, h: 32, label: t("prototype") },
    launch: { x: 330, y: 195, w: 84, h: 32, label: t("launch") },
    metrics: { x: 58, y: 310, w: 92, h: 32, label: t("metrics") },
    risks: { x: 285, y: 318, w: 78, h: 32, label: t("risks") },
    demo: { x: 248, y: 18, w: 64, h: 28, label: t("demo") },
    release: { x: 155, y: 385, w: 72, h: 28, label: t("release") },
    // edge bleed — intentionally near/over viewBox bounds
    poll: { x: 12, y: 160, w: 70, h: 28, label: t("poll") },
    copy: { x: 348, y: 280, w: 70, h: 28, label: t("copy") },
  } as const;

  const edge = (
    ax: number,
    ay: number,
    ahw: number,
    ahh: number,
    bx: number,
    by: number,
  ) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = Math.abs(ux) < 1e-9 ? 1e9 : ahw / Math.abs(ux);
    const sy = Math.abs(uy) < 1e-9 ? 1e9 : ahh / Math.abs(uy);
    const t = Math.min(sx, sy) * 0.92;
    return [ax + ux * t, ay + uy * t] as const;
  };

  const line = (
    ax: number,
    ay: number,
    ahw: number,
    ahh: number,
    bx: number,
    by: number,
    bhw: number,
    bhh: number,
  ) => {
    const [x1, y1] = edge(ax, ay, ahw, ahh, bx, by);
    const [x2, y2] = edge(bx, by, bhw, bhh, ax, ay);
    return { x1, y1, x2, y2 };
  };

  const ch = 22;
  const links = [
    line(C.x, C.y, 48, ch, nodes.research.x, nodes.research.y, nodes.research.w / 2, nodes.research.h / 2),
    line(C.x, C.y, 48, ch, nodes.proto.x, nodes.proto.y, nodes.proto.w / 2, nodes.proto.h / 2),
    line(C.x, C.y, 48, ch, nodes.launch.x, nodes.launch.y, nodes.launch.w / 2, nodes.launch.h / 2),
    line(C.x, C.y, 48, ch, nodes.metrics.x, nodes.metrics.y, nodes.metrics.w / 2, nodes.metrics.h / 2),
    line(C.x, C.y, 48, ch, nodes.risks.x, nodes.risks.y, nodes.risks.w / 2, nodes.risks.h / 2),
    line(nodes.proto.x, nodes.proto.y, nodes.proto.w / 2, nodes.proto.h / 2, nodes.demo.x, nodes.demo.y, nodes.demo.w / 2, nodes.demo.h / 2),
    line(nodes.risks.x, nodes.risks.y, nodes.risks.w / 2, nodes.risks.h / 2, nodes.release.x, nodes.release.y, nodes.release.w / 2, nodes.release.h / 2),
    line(C.x, C.y, 48, ch, nodes.poll.x, nodes.poll.y, nodes.poll.w / 2, nodes.poll.h / 2),
    line(nodes.launch.x, nodes.launch.y, nodes.launch.w / 2, nodes.launch.h / 2, nodes.copy.x, nodes.copy.y, nodes.copy.w / 2, nodes.copy.h / 2),
  ];

  return (
    <div className={`ld-mvis ld-mvis-canvas${armed ? " is-armed" : ""}`} aria-hidden>
      <svg className="ld-mvis-svg" viewBox="0 0 360 400" preserveAspectRatio="xMidYMid meet">
        <g className="ld-mvis-links">
          {links.map((l, i) => (
            <line key={i} className={`ld-ml ld-ml${i + 1}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          ))}
        </g>
        <ellipse className="ld-mshape-svg" cx="40" cy="220" rx="30" ry="18" />
        <rect className="ld-mshape-svg" x="300" y="240" width="44" height="30" rx="8" />
        <path className="ld-mshape-svg" d="M160 48 L188 36 L178 68 Z" />
        <g className="ld-mvis-core-svg" transform={`translate(${C.x} ${C.y})`}>
          <rect x="-48" y="-22" width="96" height="44" rx="22" />
          <text>{t("thought")}</text>
        </g>
        <MobPill x={nodes.research.x} y={nodes.research.y} w={nodes.research.w} h={nodes.research.h} label={nodes.research.label} />
        <MobPill x={nodes.proto.x} y={nodes.proto.y} w={nodes.proto.w} h={nodes.proto.h} label={nodes.proto.label} />
        <MobPill x={nodes.launch.x} y={nodes.launch.y} w={nodes.launch.w} h={nodes.launch.h} label={nodes.launch.label} />
        <MobPill x={nodes.metrics.x} y={nodes.metrics.y} w={nodes.metrics.w} h={nodes.metrics.h} label={nodes.metrics.label} />
        <MobPill x={nodes.risks.x} y={nodes.risks.y} w={nodes.risks.w} h={nodes.risks.h} label={nodes.risks.label} />
        <MobPill x={nodes.demo.x} y={nodes.demo.y} w={nodes.demo.w} h={nodes.demo.h} label={nodes.demo.label} />
        <MobPill x={nodes.release.x} y={nodes.release.y} w={nodes.release.w} h={nodes.release.h} label={nodes.release.label} />
        <MobPill x={nodes.poll.x} y={nodes.poll.y} w={nodes.poll.w} h={nodes.poll.h} label={nodes.poll.label} />
        <MobPill x={nodes.copy.x} y={nodes.copy.y} w={nodes.copy.w} h={nodes.copy.h} label={nodes.copy.label} />
      </svg>
    </div>
  );
}

function FieldRun({ children, phase, armed }: { children: ReactNode; phase: FieldPhase; armed: boolean }) {
  return (
    <div className="ld-field-run" data-phase={phase} data-armed={armed ? "1" : "0"}>
      <div className="ld-scene-rail ld-scene-rail-desktop" aria-hidden>
        <div className="ld-scene-sticky">
          <SharedFieldScene phase={phase} armed={armed} />
        </div>
      </div>
      {children}
    </div>
  );
}

/** Text screen — slash-command insert demo */
const SLASH_KEYS = ["slashText", "slashHeading", "slashQuote", "slashCode"] as const;
const AI_SCENE_COUNT = 6;

function EditorDoc({ active }: { active: boolean }) {
  const t = useTranslations("landing.demo");
  const slashItems = SLASH_KEYS.map((k) => t(k));
  const [slash, setSlash] = useState("");
  const [menu, setMenu] = useState(false);
  const [hi, setHi] = useState(0);
  const [inserted, setInserted] = useState(false);
  const [baseIn, setBaseIn] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlash("");
      setMenu(false);
      setHi(0);
      setInserted(false);
      setBaseIn(false);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    (async () => {
      setBaseIn(true);
      await wait(1600);
      if (cancelled) return;

      while (!cancelled) {
        setInserted(false);
        setMenu(false);
        setHi(0);
        setSlash("");
        await wait(400);
        if (cancelled) return;
        setSlash("/");
        await wait(280);
        if (cancelled) return;
        setMenu(true);
        for (let i = 0; i < SLASH_KEYS.length; i++) {
          if (cancelled) return;
          setHi(i);
          await wait(300);
        }
        setHi(2);
        await wait(420);
        if (cancelled) return;
        setMenu(false);
        setSlash("");
        setInserted(true);
        await wait(2800);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active]);

  return (
    <div className={`ld-doc${baseIn ? " is-in" : ""}${inserted ? " is-inserted" : ""}`}>
      <p className="ld-doc-meta">{t("docMeta")}</p>
      <h3 className="ld-doc-title">
        <span className="ld-type">{t("docTitle")}</span>
        <i className="ld-caret" />
      </h3>
      <p className="ld-doc-p ld-dp1">{t("docP1")}</p>
      <p className="ld-doc-p ld-dp2">{t("docP2")}</p>

      <ul className="ld-doc-list">
        <li className="ld-dk1">
          <i />
          {t("docListSnap")}
        </li>
        <li className="ld-dk2">
          <i />
          {t("docListPublic")}
        </li>
        <li className="ld-dk3">
          <i />
          {t("docListSync")}
        </li>
      </ul>

      <div className={`ld-doc-insert${inserted ? " is-on" : ""}`}>
        <p className="ld-doc-insert-label">{t("quoteLabel")}</p>
        <blockquote>{t("quoteBody")}</blockquote>
      </div>

      <div className="ld-doc-compose">
        <p className="ld-doc-line">
          {slash ? (
            <>
              <span className="ld-doc-slash-typed">{slash}</span>
              <i className="ld-caret ld-caret-inline" />
            </>
          ) : (
            <>
              <span className="ld-doc-ph-text">{t("phWrite")}</span>
              <kbd>/</kbd>
              <i className="ld-caret ld-caret-inline" />
            </>
          )}
        </p>
        <div className={`ld-slash${menu ? " is-open" : ""}`} aria-hidden>
          <span className="ld-slash-h">{t("slashInsert")}</span>
          {slashItems.map((item, i) => (
            <button key={SLASH_KEYS[i]} type="button" tabIndex={-1} className={hi === i ? "is-on" : ""}>
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type ChatPhase = "compose" | "sent" | "reply" | "hold" | "fade";

function AiChatReel({ active }: { active: boolean }) {
  const t = useTranslations("landing.demo");
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState<ChatPhase>("compose");
  const [inputText, setInputText] = useState("");
  const [userMsg, setUserMsg] = useState<string | null>(null);
  const [botText, setBotText] = useState("");
  const [showBot, setShowBot] = useState(false);
  const [fading, setFading] = useState(false);

  const n = scene + 1;
  const curUser = t(`ai${n}User` as "ai1User");
  const curBot = t(`ai${n}Bot` as "ai1Bot");

  useEffect(() => {
    if (!active) return;
    setScene(0);
    setPhase("compose");
    setInputText("");
    setUserMsg(null);
    setBotText("");
    setShowBot(false);
    setFading(false);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    const typeInto = async (full: string, set: (v: string) => void, speed: number) => {
      set("");
      for (let i = 1; i <= full.length; i++) {
        if (cancelled) return;
        set(full.slice(0, i));
        await wait(speed);
      }
    };

    (async () => {
      if (phase === "compose") {
        setFading(false);
        setUserMsg(null);
        setShowBot(false);
        setBotText("");
        setInputText("");
        await wait(280);
        if (cancelled) return;
        await typeInto(curUser, setInputText, 22);
        if (cancelled) return;
        await wait(220);
        if (cancelled) return;
        setPhase("sent");
      } else if (phase === "sent") {
        setUserMsg(curUser);
        setInputText("");
        await wait(380);
        if (cancelled) return;
        setPhase("reply");
      } else if (phase === "reply") {
        setShowBot(true);
        setBotText("");
        await wait(160);
        if (cancelled) return;
        await typeInto(curBot, setBotText, 14);
        if (cancelled) return;
        setPhase("hold");
      } else if (phase === "hold") {
        await wait(2100);
        if (cancelled) return;
        setPhase("fade");
      } else {
        setFading(true);
        await wait(420);
        if (cancelled) return;
        setUserMsg(null);
        setShowBot(false);
        setBotText("");
        setFading(false);
        setScene((s) => (s + 1) % AI_SCENE_COUNT);
        setPhase("compose");
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active, phase, scene, curUser, curBot]);

  return (
    <div className="ld-chat" data-phase={phase}>
      <div className={`ld-chat-thread${fading ? " is-fading" : ""}`}>
        {userMsg ? <div className="ld-msg ld-msg-u">{userMsg}</div> : null}
        {showBot ? (
          <div className="ld-msg ld-msg-a">
            <em>Relay AI</em>
            <p>
              {botText}
              {phase === "reply" ? <i className="ld-chat-caret" /> : null}
            </p>
          </div>
        ) : null}
      </div>
      <div className="ld-chat-compose">
        <div className="ld-chat-input">
          {inputText ? <span>{inputText}</span> : null}
          {!inputText && phase === "compose" ? <em className="ld-chat-ph">{t("chatPhWrite")}</em> : null}
          {!inputText && phase !== "compose" ? <em className="ld-chat-ph">{t("chatPhMessage")}</em> : null}
          {phase === "compose" ? <i className="ld-chat-caret" /> : null}
        </div>
        <span className={`ld-chat-send${phase === "compose" && inputText ? " is-on" : ""}`} aria-hidden>
          ↑
        </span>
      </div>
    </div>
  );
}

function SyncCards() {
  const t = useTranslations("landing.demo");
  return (
    <div className="ld-sync">
      <div className="ld-sync-card ld-sync-local">
        <span>{t("guest")}</span>
        <strong>{t("local")}</strong>
        <p>{t("localFile")}</p>
      </div>
      <div className="ld-sync-beam" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="ld-sync-card ld-sync-cloud">
        <span>{t("cloud")}</span>
        <strong>{t("team")}</strong>
        <p className="ld-sync-ok">{t("inSync")}</p>
      </div>
    </div>
  );
}

export function LandingInteractive() {
  const t = useTranslations("landing");
  const ai = useInView(400);
  const canvasSec = useInView(4200);
  const heroSec = useInView(3600);
  const textSec = useInView(1200);
  const fieldArmed = heroSec.play || canvasSec.play;
  const [fieldPhase, setFieldPhase] = useState<FieldPhase>("hero");

  useEffect(() => {
    const canvas = document.getElementById("canvas");
    if (!canvas) return;

    const update = () => {
      const r = canvas.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // scene expands when canvas section reaches mid-viewport
      setFieldPhase(r.top < vh * 0.58 ? "expand" : "hero");
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="ld">
      <nav className="ld-nav">
        <BrandLockup size={28} />
        <div className="ld-nav-actions">
          <LanguageToggle variant="landing" />
          <ThemeToggle variant="landing" />
          <Link href="/login" className="ld-nav-login">
            {t("navLogin")}
          </Link>
          <Link href="/register" className="ld-nav-cta">
            {t("navStart")}
          </Link>
        </div>
      </nav>

      <FieldRun phase={fieldPhase} armed={fieldArmed}>
        <section
          ref={heroSec.ref}
          id="top"
          className="ld-stage ld-hero ld-field-sec"
          data-play={heroSec.play ? "1" : "0"}
          data-idle={heroSec.idle ? "1" : "0"}
        >
          <div className="ld-shell ld-shell-field ld-shell-hero-m">
            <MobileHeroDecor armed={heroSec.play || fieldArmed} />
            <div className="ld-copy ld-copy-on-field">
              <p className="ld-kicker">Relay</p>
              <h1>
                <span className="ld-h1-line">{t("heroLine1")}</span>
                <span className="ld-h1-line">
                  <em>{t("heroLine2")}</em>
                </span>
              </h1>
              <p className="ld-lede">{t("heroLede")}</p>
              <div className="ld-cta">
                <Link href="/register" className="ld-btn">
                  {t("ctaCreate")}
                </Link>
                <a href="#canvas" className="ld-btn-soft">
                  {t("ctaSee")}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={canvasSec.ref}
          id="canvas"
          className="ld-stage ld-row ld-field-sec ld-field-canvas"
          data-play={canvasSec.play ? "1" : "0"}
          data-idle={canvasSec.idle ? "1" : "0"}
        >
          <div className="ld-shell ld-shell-field">
            <div className="ld-copy ld-copy-on-field">
              <p className="ld-eyebrow">{t("canvasEyebrow")}</p>
              <h2>{t("canvasTitle")}</h2>
              <p>{t("canvasBody")}</p>
            </div>
            <MobileCanvasVisual armed={canvasSec.play} />
          </div>
        </section>
      </FieldRun>

      <section
        ref={textSec.ref}
        id="text"
        className="ld-stage ld-row ld-row-alt"
        data-play={textSec.play ? "1" : "0"}
        data-idle={textSec.idle ? "1" : "0"}
      >
        <div className="ld-shell">
          <div className="ld-copy">
            <p className="ld-eyebrow">{t("textEyebrow")}</p>
            <h2>{t("textTitle")}</h2>
            <p>{t("textBody")}</p>
          </div>
          <Panel soft={false} className="ld-panel-doc">
            <EditorDoc active={textSec.play} />
          </Panel>
        </div>
      </section>

      <section
        ref={ai.ref}
        id="ai"
        className="ld-stage ld-row"
        data-play={ai.play ? "1" : "0"}
        data-idle={ai.idle ? "1" : "0"}
      >
        <div className="ld-shell">
          <div className="ld-copy">
            <p className="ld-eyebrow">{t("aiEyebrow")}</p>
            <h2>{t("aiTitle")}</h2>
            <p>{t("aiBody")}</p>
            <p className="ld-soon">{t("aiSoon")}</p>
          </div>
          <Panel soft={false} className="ld-panel-chat">
            <AiChatReel active={ai.play} />
          </Panel>
        </div>
      </section>

      <Stage className="ld-row ld-row-center" id="start" idleAfterMs={1500}>
        <div className="ld-shell ld-shell-stack">
          <div className="ld-copy ld-copy-center">
            <p className="ld-eyebrow">{t("startEyebrow")}</p>
            <h2>{t("startTitle")}</h2>
          </div>
          <Panel soft={false} className="ld-panel-narrow">
            <SyncCards />
          </Panel>
          <p className="ld-sync-lede">{t("startLede")}</p>
        </div>
      </Stage>

      <Stage className="ld-close" id="try" idleAfterMs={600}>
        <div className="ld-close-box">
          <p className="ld-close-brand">Relay</p>
          <h2>{t("closeTitle")}</h2>
          <p>{t("closeBody")}</p>
          <div className="ld-close-actions">
            <Link href="/register" className="ld-btn-mega">
              {t("closeCta")}
            </Link>
            <Link href="/login" className="ld-btn-mega-ghost">
              {t("closeLogin")}
            </Link>
          </div>
        </div>
      </Stage>

      <footer className="ld-foot">
        <BrandLockup size={22} />
        <span suppressHydrationWarning>© {new Date().getFullYear()} Relay</span>
      </footer>
    </div>
  );
}
