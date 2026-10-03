"use client";

import { useEffect, useState } from "react";
import { pageBounds, type Bounds, type Editor } from "@quickdrawjs/core";

export type BoardActivityFocusRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
};

function union(a: Bounds | null, b: Bounds): Bounds {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y };
}

export function useBoardActivityFocus(editor: Editor | null, shapeIds?: string[]) {
  const [rect, setRect] = useState<BoardActivityFocusRect | null>(null);
  const idsKey = shapeIds?.join("\u0000") ?? "";

  useEffect(() => {
    if (!editor || !idsKey) return;
    const ids = idsKey.split("\u0000");
    let bounds: Bounds | null = null;
    for (const id of ids) {
      const record = editor.store.get(id);
      if (!record || record.typeName !== "shape") continue;
      bounds = union(bounds, pageBounds(record));
    }
    if (!bounds) return;

    const updateRect = () => {
      if (!bounds) return;
      const first = editor.pageToScreen(bounds.x, bounds.y);
      const last = editor.pageToScreen(bounds.x + bounds.w, bounds.y + bounds.h);
      const padding = 10;
      const rawWidth = last.x - first.x + padding * 2;
      const rawHeight = last.y - first.y + padding * 2;
      setRect((current) => ({
        left: first.x - padding - Math.max(0, 28 - rawWidth) / 2,
        top: first.y - padding - Math.max(0, 28 - rawHeight) / 2,
        width: Math.max(28, rawWidth),
        height: Math.max(28, rawHeight),
        visible: current?.visible ?? false,
      }));
    };

    const viewport = editor.viewportPageBounds();
    const breathingRoom = 36 / editor.camera.z;
    const visible =
      bounds.x >= viewport.x + breathingRoom &&
      bounds.y >= viewport.y + breathingRoom &&
      bounds.x + bounds.w <= viewport.x + viewport.w - breathingRoom &&
      bounds.y + bounds.h <= viewport.y + viewport.h - breathingRoom;
    const screenWidth = bounds.w * editor.camera.z;
    const screenHeight = bounds.h * editor.camera.z;
    const tooSmallToRead = Math.max(screenWidth, screenHeight) < 160 || Math.min(screenWidth, screenHeight) < 28;

    const stopCamera = editor.on("camera", updateRect);
    updateRect();
    const showFrame = window.requestAnimationFrame(() => {
      setRect((current) => (current ? { ...current, visible: true } : current));
    });
    if (!visible || tooSmallToRead) {
      const view = editor.viewSize();
      const marginX = Math.max(84, view.w * 0.2);
      const marginY = Math.max(72, view.h * 0.2);
      const fit = Math.min(
        (view.w - marginX * 2) / Math.max(1, bounds.w),
        (view.h - marginY * 2) / Math.max(1, bounds.h),
      );
      const maxDimension = Math.max(1, bounds.w, bounds.h);
      const minDimension = Math.max(1, Math.min(bounds.w, bounds.h));
      const detailScale = Math.min(1.6, Math.max(180 / maxDimension, 64 / minDimension));
      const z = Math.max(0.05, Math.min(Math.max(editor.camera.z, detailScale), fit, 1.6));
      editor.setCamera(
        {
          z,
          x: view.w / 2 / z - (bounds.x + bounds.w / 2),
          y: view.h / 2 / z - (bounds.y + bounds.h / 2),
        },
        { animate: 620 },
      );
    }

    const fadeTimer = window.setTimeout(() => {
      setRect((current) => (current ? { ...current, visible: false } : current));
    }, 2900);
    const removeTimer = window.setTimeout(() => setRect(null), 3500);
    return () => {
      window.cancelAnimationFrame(showFrame);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      stopCamera();
      setRect(null);
    };
  }, [editor, idsKey]);

  return rect;
}
