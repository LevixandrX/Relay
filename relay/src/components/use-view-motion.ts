"use client";

import { useLayoutEffect, useRef } from "react";

type Direction = "forward" | "back" | "up";

/** Animate a committed view without retaining or delaying interactive content. */
export function useViewMotion<Element extends HTMLElement>(view: string | null, direction: Direction = "up") {
  const ref = useRef<Element>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!view || !element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const translate = direction === "forward" ? "8px 0" : direction === "back" ? "-8px 0" : "0 5px";
    const animation = element.animate(
      [{ opacity: 0.62, translate }, { opacity: 1, translate: "0 0" }],
      { duration: 220, easing: "cubic-bezier(.2, .8, .2, 1)" },
    );
    return () => animation.cancel();
  }, [view, direction]);
  return ref;
}
