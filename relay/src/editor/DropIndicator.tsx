"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
export type DropLine = { left: number; top: number; width: number; height: number; axis: "horizontal" | "vertical" };
export function DropIndicator({ line }: { line: DropLine | null }) {
  const [last, setLast] = useState(line), [visible, setVisible] = useState(false);
  useEffect(() => {
    if (line) { setLast(line); const frame=requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(frame); }
    setVisible(false); const timer=window.setTimeout(() => setLast(null),140); return () => window.clearTimeout(timer);
  }, [line]);
  return last ? createPortal(<div aria-hidden="true" className="editor-block-drop-line" data-visible={visible} data-axis={last.axis} style={{ left:last.left,top:last.top,width:last.width,height:last.height }} />,document.body) : null;
}
