"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { shortcutGroups, type ShortcutKey } from "../lib/board/shortcuts";
import { SHORTCUTS_TOGGLE, toggleBoardShortcuts } from "../lib/board/shortcuts-bus";
import { useModLabel } from "../lib/board/mod-key";
import { OverlayScroll } from "../lib/board/CompactRailScroll";

type Tab = "guide" | "keys";

function Kbd({ children, wide }: { children: string; wide?: boolean }) {
  return (
    <kbd className="relay-kbd" data-wide={wide ? "true" : undefined}>
      {children}
    </kbd>
  );
}

function Combo({ keys }: { keys: ShortcutKey[] }) {
  return (
    <span className="relay-kbd-combo">
      {keys.map((key, i) => (
        <span key={i} className="relay-kbd-unit">
          {i > 0 ? <span className="relay-kbd-plus">+</span> : null}
          <Kbd wide={key.wide}>{key.label}</Kbd>
        </span>
      ))}
    </span>
  );
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.55" />
      <path
        d="M9.55 9.45a2.55 2.55 0 1 1 3.55 2.38c-.78.36-1.1.86-1.1 1.62"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.85" r="1.05" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 6.5l11 11M17.5 6.5l-11 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Owns the open state for the help surface; F1 and Ctrl+/ toggle it anywhere. */
function useHelpPanel() {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const slash = e.key === "/" || e.code === "Slash";
      const helpCombo = (e.ctrlKey || e.metaKey) && slash && !e.altKey;
      if (e.key === "F1" || (helpCombo && !typing)) {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === "Escape" && openRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener(SHORTCUTS_TOGGLE, toggle);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener(SHORTCUTS_TOGGLE, toggle);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  return { open, close: () => setOpen(false) };
}

/** Help affordance for app chrome (web topbar / desktop titlebar). */
export function HelpButton({ className = "relay-icon-btn relay-icon-btn-surface" }: { className?: string }) {
  const t = useTranslations("help");
  return (
    <button
      type="button"
      className={className}
      /* pointerdown, not click: inside the Tauri drag region a click can wait
         for the native drag gesture to resolve before it reaches React */
      onPointerDown={(e) => {
        e.preventDefault();
        toggleBoardShortcuts();
      }}
      title={`${t("title")} · F1`}
      aria-label={t("title")}
      aria-haspopup="dialog"
    >
      <HelpIcon />
    </button>
  );
}

function GuideTab() {
  const t = useTranslations("help");
  const items = ["guideCanvas", "guidePages", "guideTools", "guideSync", "guideShare"];
  return (
    <div className="relay-help-guide">
      {items.map((id) => (
        <section key={id}>
          <h3>{t(`${id}Title`)}</h3>
          <p>{t(id)}</p>
        </section>
      ))}
    </div>
  );
}

function KeysTab() {
  const t = useTranslations("help");
  const mod = useModLabel();
  const groups = shortcutGroups(t, mod);

  return (
    <div className="relay-help-keys">
      {groups.map((group) => (
        <section key={group.title} className="relay-help-group">
          <h3>{t(group.title)}</h3>
          <ul>
            {group.rows.map((row) => (
              <li key={row.label}>
                <Combo keys={row.keys} />
                <span className="relay-help-label">{t(row.label)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Non-modal help surface: the canvas keeps working underneath, so a shortcut
 * can be read and used in the same breath.
 */
export function HelpPanel() {
  const t = useTranslations("help");
  const { open, close } = useHelpPanel();
  const [tab, setTab] = useState<Tab>("keys");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  const onHeadPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    setPos({ x: r.left, y: r.top });
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onHeadPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 420;
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, e.clientX - drag.current.dx));
    const y = Math.min(window.innerHeight - 48, Math.max(8, e.clientY - drag.current.dy));
    setPos({ x, y });
  };

  const onHeadPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  if (!open) return null;

  return (
    <div
      id="relay-help-panel"
      ref={panelRef}
      className="relay-help"
      data-moved={pos ? "true" : undefined}
      role="dialog"
      aria-modal="false"
      aria-labelledby="relay-help-title"
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", transform: "none" } : undefined}
    >
      <header
        className="relay-help-head"
        onPointerDown={onHeadPointerDown}
        onPointerMove={onHeadPointerMove}
        onPointerUp={onHeadPointerUp}
        onPointerCancel={onHeadPointerUp}
      >
        <h2 id="relay-help-title">{t("title")}</h2>
        <div className="relay-help-tabs" role="tablist" aria-label={t("title")}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "keys"}
            data-active={tab === "keys" || undefined}
            onClick={() => setTab("keys")}
          >
            {t("tabKeys")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "guide"}
            data-active={tab === "guide" || undefined}
            onClick={() => setTab("guide")}
          >
            {t("tabGuide")}
          </button>
        </div>
        <button
          type="button"
          className="relay-help-close"
          onClick={close}
          title={t("close")}
          aria-label={t("close")}
        >
          <CloseIcon />
        </button>
      </header>

      <OverlayScroll contentClassName="relay-help-body">{tab === "keys" ? <KeysTab /> : <GuideTab />}</OverlayScroll>

      <footer className="relay-help-foot">{t("hint")}</footer>
    </div>
  );
}
