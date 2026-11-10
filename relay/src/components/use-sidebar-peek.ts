"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

const edgeWidth = 24;

/** Use the stationary shell for hit testing while the sidebar is in motion. */
export function useSidebarPeek(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  const dismiss = useRef<(() => void) | null>(null);
  const beforeNavigate = useCallback(() => {
    document.dispatchEvent(new Event("relay:navigation-start"));
    dismiss.current?.();
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element?.parentElement) return;
    const sidebar = element;
    const shell = element.parentElement;

    let open = false;
    let pointerAtEdge = false;
    let waitForEdgeExit = false;
    let width = sidebar.offsetWidth;
    let hideTimer: number | undefined;
    const resize = new ResizeObserver(() => { width = sidebar.offsetWidth; });
    resize.observe(sidebar);

    function setOpen(next: boolean) {
      window.clearTimeout(hideTimer);
      hideTimer = undefined;
      if (open === next) return;
      open = next;
      sidebar.toggleAttribute("data-peek", next);
    }

    function hide() {
      setOpen(false);
    }

    dismiss.current = () => {
      // Close before the route change mounts content. A stationary pointer
      // at the edge must not reopen the sidebar as hit targets change.
      waitForEdgeExit = pointerAtEdge;
      hide();
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && sidebar.contains(focused)) focused.blur();
    };

    function onPointer(event: PointerEvent) {
      if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
      if (event.type === "pointermove") {
        pointerAtEdge = event.clientX >= 0 && event.clientX < edgeWidth;
        if (!pointerAtEdge) waitForEdgeExit = false;
      }
      if (document.documentElement.classList.contains("editor-block-menu-open")) {
        hide();
        return;
      }

      if (!open && (event.type !== "pointermove" || waitForEdgeExit || event.buttons)) return;
      const overMenu = open && event.target.closest(".ws-menu, .relay-ws-menu");
      const inZone = shell.contains(event.target)
        && event.clientX >= 0
        && event.clientX < (open ? width : edgeWidth);
      if (overMenu || inZone) {
        setOpen(true);
      } else if (open && hideTimer === undefined) {
        hideTimer = window.setTimeout(hide, 100);
      }
    }

    function onWindowLeave() {
      pointerAtEdge = false;
      waitForEdgeExit = false;
      hide();
    }

    function onMenuState(event: Event) {
      if ((event as CustomEvent<{ open: boolean }>).detail.open) hide();
    }

    function onVisibility() {
      if (document.hidden) hide();
    }

    window.addEventListener("pointermove", onPointer, { capture: true, passive: true });
    window.addEventListener("pointerover", onPointer, { capture: true, passive: true });
    window.addEventListener("pointercancel", onWindowLeave);
    window.addEventListener("blur", onWindowLeave);
    window.addEventListener("relay:editor-menu-state", onMenuState);
    document.documentElement.addEventListener("pointerleave", onWindowLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      dismiss.current = null;
      resize.disconnect();
      hide();
      window.removeEventListener("pointermove", onPointer, true);
      window.removeEventListener("pointerover", onPointer, true);
      window.removeEventListener("pointercancel", onWindowLeave);
      window.removeEventListener("blur", onWindowLeave);
      window.removeEventListener("relay:editor-menu-state", onMenuState);
      document.documentElement.removeEventListener("pointerleave", onWindowLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return { sidebarRef: ref, beforeNavigate };
}
