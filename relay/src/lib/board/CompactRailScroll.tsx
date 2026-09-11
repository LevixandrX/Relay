"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

export function CompactRailScroll({
  target,
  itemCount = 0,
}: {
  target: RefObject<HTMLElement | null>;
  itemCount?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef({ top: 0, height: 0, show: false });
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const [metrics, setMetrics] = useState({ top: 0, height: 0, show: false });

  const measure = useCallback(() => {
    const el = target.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight > clientHeight + 1;
    if (!overflow) {
      const next = { top: 0, height: 0, show: false };
      metricsRef.current = next;
      setMetrics(next);
      return;
    }
    const height = Math.max(20, (clientHeight / scrollHeight) * clientHeight);
    const travel = Math.max(1, clientHeight - height);
    const top = (scrollTop / Math.max(1, scrollHeight - clientHeight)) * travel;
    const next = { top, height, show: true };
    metricsRef.current = next;
    setMetrics(next);
  }, [target]);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [target, itemCount, measure]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const el = target.current;
    const track = trackRef.current;
    if (!el || !track || !metricsRef.current.show) return;
    e.preventDefault();
    const rect = track.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { top, height } = metricsRef.current;
    if (y < top || y > top + height) {
      const travel = Math.max(1, el.clientHeight - height);
      const ratio = (y - height / 2) / travel;
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
      measure();
    }
    dragRef.current = { startY: e.clientY, startScroll: el.scrollTop };
    track.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = target.current;
    if (!drag || !el) return;
    const { height } = metricsRef.current;
    const travel = Math.max(1, el.clientHeight - height);
    const delta = e.clientY - drag.startY;
    el.scrollTop = drag.startScroll + (delta / travel) * (el.scrollHeight - el.clientHeight);
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div
      ref={trackRef}
      className="rail-scroll"
      data-hidden={metrics.show ? undefined : "true"}
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="rail-scroll-thumb"
        style={{ top: metrics.top, height: metrics.height }}
      />
    </div>
  );
}

export function OverlayScroll({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={["overlay-scroll", className].filter(Boolean).join(" ")}>
      <div
        ref={ref}
        className={["overlay-scroll-target", contentClassName].filter(Boolean).join(" ")}
      >
        {children}
      </div>
      <CompactRailScroll target={ref} />
    </div>
  );
}
