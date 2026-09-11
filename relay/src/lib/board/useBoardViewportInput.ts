import type { Editor } from "@quickdrawjs/core";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { clampZoom, zoomReset } from "./board-navigator";
import { physicalDigit } from "./physical-key";

const ZOOM_GAIN = 0.011;

function wheelDelta(e: WheelEvent) {
  const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  return { dx: e.deltaX * scale, dy: e.deltaY * scale };
}

function pointOnBoard(editor: Editor, clientX: number, clientY: number) {
  const rect = editor.container.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }
  return { sx: clientX - rect.left, sy: clientY - rect.top };
}

function wheelOnOverlay(e: WheelEvent) {
  const target = e.target;
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        ".sidebar",
        ".relay-sidebar",
        ".sidebar-pages",
        ".sidebar-page-rail",
        ".sidebar-page-list",
        ".relay-page-list",
        ".relay-page-rail",
        ".relay-help",
        ".relay-board-dock",
        ".relay-board-menu",
        ".palette",
        ".palette-backdrop",
        ".relay-activity-panel",
        ".version-history",
        "[role='dialog']",
        "input",
        "textarea",
        "select",
        "[contenteditable='true']",
      ].join(", "),
    ),
  );
}

function typingInField(e: Event) {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

/**
 * Window-level wheel routing — reliable in Tauri WebView2 where container listeners miss pinch.
 * Patched Quickdraw no longer registers its own wheel handler.
 */
export function useBoardViewportInput(
  editor: Editor | null,
  hostRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!editor) return;
    const host = hostRef.current;
    if (host) host.style.touchAction = "none";

    const onWheel = (e: WheelEvent) => {
      if (wheelOnOverlay(e)) return;
      const target = e.target;
      if (host && target instanceof Node && !host.contains(target)) return;

      const pt = pointOnBoard(editor, e.clientX, e.clientY);
      if (!pt) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const { dx, dy } = wheelDelta(e);
      const pinch = e.ctrlKey || e.metaKey;

      if (pinch && Math.abs(dy) > 0.01) {
        editor.zoomAt(pt.sx, pt.sy, Math.exp(-dy * ZOOM_GAIN));
        return;
      }

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        editor.pan(-dx, -dy);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (typingInField(e)) return;
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && physicalDigit(e) === "0") {
        e.preventDefault();
        zoomReset(editor);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("keydown", onKey, true);
    };
  }, [editor, hostRef]);
}

/** Hold +/- for smooth stepped zoom (Figma-style). */
export function useHoldZoom(editor: Editor, direction: "in" | "out") {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tick = () => {
    const { w, h } = editor.viewSize();
    const mult = direction === "in" ? 1.045 : 1 / 1.045;
    const next = clampZoom(editor.camera.z * mult);
    if (next === editor.camera.z) return;
    editor.zoomAt(w / 2, h / 2, mult);
  };

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    tick();
    let delay = 320;
    const schedule = () => {
      timerRef.current = setTimeout(() => {
        tick();
        delay = Math.max(48, delay * 0.82);
        schedule();
      }, delay);
    };
    schedule();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = () => stop();

  return { onPointerDown, onPointerUp, onPointerLeave: onPointerUp };
}
