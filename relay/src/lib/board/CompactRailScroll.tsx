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
  arrows = false,
  edge = false,
}: {
  target: RefObject<HTMLElement | null>;
  itemCount?: number;
  arrows?: boolean;
  edge?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef({ top: 0, height: 0, show: false });
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const repeatDelayRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  const [metrics, setMetrics] = useState({ top: 0, height: 0, show: false });
  const [nativeArrows, setNativeArrows] = useState(false);
  const showArrows = arrows && nativeArrows;

  useEffect(() => {
    setNativeArrows(/Windows NT/i.test(window.navigator.userAgent));
  }, []);

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
    const inset = showArrows ? 18 : 0;
    const trackHeight = Math.max(1, clientHeight - inset * 2);
    const height = Math.max(20, (clientHeight / scrollHeight) * trackHeight);
    const travel = Math.max(1, trackHeight - height);
    const top = inset + (scrollTop / Math.max(1, scrollHeight - clientHeight)) * travel;
    const next = { top, height, show: true };
    metricsRef.current = next;
    setMetrics(next);
  }, [showArrows, target]);

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

  const stopArrowRepeat = useCallback(() => {
    if (repeatDelayRef.current !== null) window.clearTimeout(repeatDelayRef.current);
    if (repeatIntervalRef.current !== null) window.clearInterval(repeatIntervalRef.current);
    repeatDelayRef.current = null;
    repeatIntervalRef.current = null;
  }, []);

  useEffect(() => stopArrowRepeat, [stopArrowRepeat]);

  const startArrowRepeat = useCallback(
    (direction: -1 | 1, event: PointerEvent<HTMLButtonElement>) => {
      const el = target.current;
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      stopArrowRepeat();
      const step = () => el.scrollBy({ top: direction * 40, behavior: "auto" });
      step();
      repeatDelayRef.current = window.setTimeout(() => {
        repeatIntervalRef.current = window.setInterval(step, 70);
      }, 420);
    },
    [stopArrowRepeat, target],
  );

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const el = target.current;
    const track = trackRef.current;
    if (!el || !track || !metricsRef.current.show) return;
    e.preventDefault();
    const rect = track.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const inset = showArrows ? 18 : 0;
    if (y < inset || y > rect.height - inset) return;
    const { top, height } = metricsRef.current;
    if (y < top || y > top + height) {
      const travel = Math.max(1, el.clientHeight - inset * 2 - height);
      const ratio = (y - inset - height / 2) / travel;
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
    const inset = showArrows ? 18 : 0;
    const travel = Math.max(1, el.clientHeight - inset * 2 - height);
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
      data-arrows={showArrows || undefined}
      data-edge={edge || undefined}
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {showArrows ? (
        <button
          type="button"
          className="rail-scroll-arrow"
          data-direction="up"
          tabIndex={-1}
          aria-hidden="true"
          onPointerDown={(event) => startArrowRepeat(-1, event)}
          onPointerUp={stopArrowRepeat}
          onPointerCancel={stopArrowRepeat}
          onLostPointerCapture={stopArrowRepeat}
        >
          <span className="rail-scroll-arrow-glyph" aria-hidden>{"\uF090"}</span>
        </button>
      ) : null}
      <div
        className="rail-scroll-thumb"
        style={{ top: metrics.top, height: metrics.height }}
      />
      {showArrows ? (
        <button
          type="button"
          className="rail-scroll-arrow"
          data-direction="down"
          tabIndex={-1}
          aria-hidden="true"
          onPointerDown={(event) => startArrowRepeat(1, event)}
          onPointerUp={stopArrowRepeat}
          onPointerCancel={stopArrowRepeat}
          onLostPointerCapture={stopArrowRepeat}
        >
          <span className="rail-scroll-arrow-glyph" aria-hidden>{"\uF08E"}</span>
        </button>
      ) : null}
    </div>
  );
}

export function OverlayScroll({
  children,
  className,
  contentClassName,
  arrows = false,
  edge = false,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  arrows?: boolean;
  edge?: boolean;
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
      <CompactRailScroll target={ref} arrows={arrows} edge={edge} />
    </div>
  );
}
