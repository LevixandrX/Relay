"use client";

import { CircleHelp, Search } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { shortcutGroups, type ShortcutKey } from "../lib/board/shortcuts";
import { SHORTCUTS_TOGGLE, toggleBoardShortcuts } from "../lib/board/shortcuts-bus";
import { useModLabel } from "../lib/board/mod-key";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import { useViewMotion } from "./use-view-motion";
import { PanelCloseButton } from "./PanelCloseButton";
import { OverlayPresence, OverlaySurface } from "../editor/EditorOverlay";

type Tab = "guide" | "keys";
const topics = ["guideCanvas", "guidePages", "guideTools", "guideSync", "guideShare"];

function Combo({ keys }: { keys: ShortcutKey[] }) {
  return (
    <span className="relay-kbd-combo">
      {keys.map((key, i) => (
        <span key={i} className="relay-kbd-unit">
          {i > 0 && <span className="relay-kbd-plus">+</span>}
          <kbd className="relay-kbd" data-wide={key.wide || undefined}>{key.label}</kbd>
        </span>
      ))}
    </span>
  );
}

export function HelpButton({ className = "relay-icon-btn relay-icon-btn-surface" }: { className?: string }) {
  const t = useTranslations("help");
  return (
    <button
      type="button"
      className={className}
      onClick={toggleBoardShortcuts}
      data-tooltip={`${t("title")} · F1`}
      aria-label={t("title")}
      aria-haspopup="dialog"
    >
      <CircleHelp size={17} aria-hidden />
    </button>
  );
}

export function HelpPanel() {
  const t = useTranslations("help");
  const mod = useModLabel();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("keys");
  const tabMotion = useViewMotion<HTMLDivElement>(open ? tab : null, tab === "guide" ? "forward" : "back");
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function show() {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery("");
      setOpen(true);
    }
    function toggle() { if (open) setOpen(false); else show(); }
    function key(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea") || event.target.isContentEditable);
      const helpCombo = (event.ctrlKey || event.metaKey) && !event.altKey &&
        (event.key === "/" || event.code === "Slash");
      if (event.key === "F1" || helpCombo && !typing) {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      } else if (event.key === "Escape" && open &&
        (panel.current?.contains(document.activeElement) || !document.querySelector("[data-editor-overlay-level]"))) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener(SHORTCUTS_TOGGLE, toggle);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener(SHORTCUTS_TOGGLE, toggle);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      search.current?.focus({ preventScroll: true });
    } else {
      if (panel.current?.contains(document.activeElement) || document.activeElement === document.body) {
        previousFocus.current?.focus({ preventScroll: true });
      }
      previousFocus.current = null;
    }
  }, [open]);

  useEffect(() => {
    const reset = () => setPos(null);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);

  function beginDrag(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
    const rect = panel.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current || !panel.current) return;
    const x = Math.max(8, Math.min(innerWidth - panel.current.offsetWidth - 8, event.clientX - drag.current.dx));
    const y = Math.max(8, Math.min(innerHeight - panel.current.offsetHeight - 8, event.clientY - drag.current.dy));
    setPos({ x, y });
  }

  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.every((term) => text.toLocaleLowerCase().includes(term));
  const groups = shortcutGroups(t, mod)
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) =>
        matches([t(group.title), t(row.label), ...row.keys.map((key) => key.label)].join(" "))),
    }))
    .filter((group) => group.rows.length);
  const guide = topics.filter((topic) => matches(t(`${topic}Title`) + " " + t(topic)));
  const empty = tab === "keys" ? !groups.length : !guide.length;

  return (
    <OverlayPresence visible={open}>
      {open ? createPortal(
        <OverlaySurface
          surfaceRef={panel}
          className="relay-help relay-help-searchable"
          role="dialog"
          aria-labelledby="relay-help-title"
          style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <header
            className="relay-help-head"
            onPointerDown={beginDrag}
            onPointerMove={move}
            onLostPointerCapture={() => { drag.current = null; }}
          >
            <CircleHelp size={18} aria-hidden />
            <h2 id="relay-help-title">{t("title")}</h2>
            <PanelCloseButton onClick={() => setOpen(false)} aria-label={t("close")} />
          </header>
          <div className="relay-help-controls">
            <label className="relay-help-search">
              <Search size={16} aria-hidden />
              <input ref={search} type="search" aria-label={t("searchHelp")} placeholder={t("searchHelp")} value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="relay-help-tabs" role="group" aria-label={t("title")}>
              {(["keys", "guide"] as const).map((item) => (
                <button key={item} type="button" aria-pressed={tab === item} data-active={tab === item || undefined} onClick={() => setTab(item)}>
                  {t(item === "keys" ? "tabKeys" : "tabGuide")}
                </button>
              ))}
            </div>
          </div>
          <OverlayScroll ref={tabMotion} arrows key={tab} contentClassName="relay-help-body">
            {empty ? <p className="relay-help-empty" role="status">{t("noHelpResults")}</p> : tab === "keys" ? (
              <div className="relay-help-keys">
                {groups.map((group) => (
                  <section key={group.title} className="relay-help-group">
                    <h3>{t(group.title)}</h3>
                    <ul>{group.rows.map((row) => (
                      <li key={row.label}>
                        <span className="relay-help-label">{t(row.label)}</span>
                        <Combo keys={row.keys} />
                      </li>
                    ))}</ul>
                  </section>
                ))}
              </div>
            ) : (
              <div className="relay-help-guide">
                {guide.map((topic) => <section key={topic}><h3>{t(`${topic}Title`)}</h3><p>{t(topic)}</p></section>)}
              </div>
            )}
          </OverlayScroll>
          <footer className="relay-help-foot">{t("hint")}</footer>
        </OverlaySurface>, document.body,
      ) : null}
    </OverlayPresence>
  );
}
