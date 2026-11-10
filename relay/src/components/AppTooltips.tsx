"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OverlayPresence, OverlaySurface } from "../editor/EditorOverlay";
import { belowTooltip } from "../editor/tooltip-position";

type Tip = { anchor: HTMLElement; label: string };
const triggers = "[data-tooltip],[data-editor-tooltip],[title],button[aria-label],a[aria-label]";

export function AppTooltips() {
  const id = useId();
  const surface = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useLayoutEffect(() => {
    const el = surface.current;
    if (!el || !tip?.anchor.isConnected) return;
    const anchor = tip.anchor.getBoundingClientRect();
    const size = el.getBoundingClientRect();
    const viewport = { width: innerWidth, height: innerHeight };
    const placement = belowTooltip(anchor, size, viewport);
    const above = tip.anchor.dataset.tooltipPlacement !== "below" && anchor.top >= size.height + 20;
    el.style.left = `${placement.left - size.width / 2}px`;
    el.style.top = `${above ? anchor.top - size.height - 8 : placement.top}px`;
    el.style.visibility = "visible";
  }, [tip]);

  useEffect(() => {
    let anchor: HTMLElement | null = null;
    let title: string | null = null;
    let temporaryLabel: string | null = null;
    let timer = 0;
    let leaveTimer = 0;
    const observer = new MutationObserver((changes) => {
      if (anchor && (!anchor.isConnected || changes.some((change) => change.type === "attributes"))) hide();
    });
    function hide() {
      clearTimeout(timer);
      clearTimeout(leaveTimer);
      observer.disconnect();
      if (anchor) {
        if (title !== null && anchor.getAttribute("title") === "") anchor.setAttribute("title", title);
        if (temporaryLabel && anchor.getAttribute("aria-label") === temporaryLabel) anchor.removeAttribute("aria-label");
        const ids = anchor.getAttribute("aria-describedby")?.split(/\s+/).filter((value) => value !== id);
        if (ids?.length) anchor.setAttribute("aria-describedby", ids.join(" "));
        else anchor.removeAttribute("aria-describedby");
      }
      anchor = null;
      title = null;
      temporaryLabel = null;
      setTip(null);
    }
    function show(target: EventTarget | null, keyboard = false) {
      if (!(target instanceof Element)) return;
      if (surface.current?.contains(target)) {
        clearTimeout(leaveTimer);
        return;
      }
      const next = target.closest<HTMLElement>(triggers);
      if (!next || next.closest("[inert],[data-tooltip-off]") || next.matches(":disabled,iframe") ||
          document.documentElement.classList.contains("editor-table-dragging")) {
        hide();
        return;
      }
      if (next === anchor) {
        clearTimeout(leaveTimer);
        return;
      }
      hide();
      const native = next.getAttribute("title");
      const label = next.dataset.tooltip || next.dataset.editorTooltip || native ||
        (next.textContent?.trim() ? null : next.getAttribute("aria-label"));
      if (!label?.trim()) return;
      anchor = next;
      title = native;
      if (native !== null) {
        if (!next.hasAttribute("aria-label") && !next.hasAttribute("aria-labelledby") && !next.textContent?.trim()) {
          temporaryLabel = native;
          next.setAttribute("aria-label", native);
        }
        next.setAttribute("title", "");
      }
      observer.observe(document.body, { childList: true, subtree: true });
      observer.observe(next, { attributeFilter: ["title", "data-tooltip", "data-editor-tooltip", "aria-label", "disabled"] });
      timer = window.setTimeout(() => {
        if (!next.isConnected || !next.getClientRects().length) { hide(); return; }
        next.setAttribute("aria-describedby", [next.getAttribute("aria-describedby"), id].filter(Boolean).join(" "));
        setTip({ anchor: next, label });
      }, keyboard ? 0 : 320);
    }
    const over = (event: PointerEvent) => { if (event.pointerType !== "touch" && !event.buttons) show(event.target); };
    const out = (event: PointerEvent) => {
      const next = event.relatedTarget;
      if (!anchor || next instanceof Node && (anchor.contains(next) || surface.current?.contains(next))) return;
      clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(hide, 120);
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) show(event.target, true);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", key);
    document.addEventListener("relay:table-drag-start", hide);
    document.addEventListener("relay:navigation-start", hide);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", key);
      document.removeEventListener("relay:table-drag-start", hide);
      document.removeEventListener("relay:navigation-start", hide);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [id]);

  return (
    <OverlayPresence visible={Boolean(tip)}>
      {tip ? createPortal(
        <OverlaySurface surfaceRef={surface} id={id} role="tooltip" className="relay-tooltip" style={{ visibility: "hidden" }}>
          {tip.label}
        </OverlaySurface>,
        document.body,
      ) : null}
    </OverlayPresence>
  );
}
