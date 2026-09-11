"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@quickdrawjs/core";
import { useTranslations } from "use-intl";
import {
  centerCameraOn,
  drawMinimap,
  formatZoom,
  minimapToWorld,
  minimapTransform,
  navigatorWorld,
  parseZoomInput,
  setZoomLevel,
  viewportMinimapRect,
  zoomFit,
  zoomIn,
  zoomOut,
  zoomReset,
  type MinimapTransform,
} from "../lib/board/board-navigator";
import type { BoardPeer } from "../lib/board/sync-shared";
import { useHoldZoom } from "../lib/board/useBoardViewportInput";

const MAP_W = 168;
const MAP_H = 108;

function IconMinus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg className="relay-board-dock-chev" width="9" height="9" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M2.5 7.5 6 4l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M2.5 6.4 4.9 8.8 9.5 3.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

type Props = {
  editor: Editor;
  peers: BoardPeer[];
  dark?: boolean;
};

/**
 * Zoom control follows the pattern canvas tools converge on: two steppers and a
 * percentage that opens the rest. Keeping the bar at three controls is what
 * makes it survive narrow boards and long translations.
 */
export function BoardChrome({ editor, peers, dark = false }: Props) {
  const t = useTranslations("board");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<MinimapTransform | null>(null);
  const dragRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(() => editor.camera.z);
  const [zoomDraft, setZoomDraft] = useState(() => formatZoom(editor.camera.z));
  const [editingZoom, setEditingZoom] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const holdIn = useHoldZoom(editor, "in");
  const holdOut = useHoldZoom(editor, "out");

  const repaintMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapOpen) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const world = navigatorWorld(editor);
    transformRef.current = minimapTransform(world, MAP_W, MAP_H, 8);
    drawMinimap(ctx, editor, MAP_W, MAP_H, dark);
  }, [editor, dark, mapOpen]);

  useEffect(() => {
    const sync = () => {
      setZoom(editor.camera.z);
      if (!editingZoom) setZoomDraft(formatZoom(editor.camera.z));
      repaintMinimap();
    };
    const offCam = editor.on("camera", sync);
    const offChange = editor.on("change", repaintMinimap);
    sync();
    return () => {
      offCam();
      offChange();
    };
  }, [editor, editingZoom, repaintMinimap]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!dockRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const applyZoomDraft = () => {
    const z = parseZoomInput(zoomDraft);
    if (z == null) setZoomDraft(formatZoom(editor.camera.z));
    else setZoomLevel(editor, z);
    setEditingZoom(false);
  };

  const runFromMenu = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const onMinimapPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const tform = transformRef.current;
    if (!tform) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vp = viewportMinimapRect(editor, tform);
    const onVp = mx >= vp.x && mx <= vp.x + vp.w && my >= vp.y && my <= vp.y + vp.h;

    if (onVp) {
      dragRef.current = true;
      const center = editor.viewportPageBounds();
      const worldCenter = { x: center.x + center.w / 2, y: center.y + center.h / 2 };
      const worldAt = minimapToWorld(tform, mx, my);
      dragOffsetRef.current = { x: worldAt.x - worldCenter.x, y: worldAt.y - worldCenter.y };
    } else {
      const world = minimapToWorld(tform, mx, my);
      centerCameraOn(editor, world.x, world.y);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMinimapPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const tform = transformRef.current;
    if (!tform) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const world = minimapToWorld(tform, e.clientX - rect.left, e.clientY - rect.top);
    centerCameraOn(editor, world.x - dragOffsetRef.current.x, world.y - dragOffsetRef.current.y, 0);
  };

  const endMinimapDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <>
      <div className="relay-board-dock" data-theme={dark ? "dark" : "light"} ref={dockRef}>
        {mapOpen ? (
          <div className="relay-board-dock-map">
            <canvas
              ref={canvasRef}
              className="relay-board-dock-minimap"
              width={MAP_W}
              height={MAP_H}
              aria-label={t("mapAria")}
              onPointerDown={onMinimapPointerDown}
              onPointerMove={onMinimapPointerMove}
              onPointerUp={endMinimapDrag}
              onPointerCancel={endMinimapDrag}
            />
          </div>
        ) : null}

        {menuOpen ? (
          <div className="relay-board-menu" role="menu" aria-label={t("zoomMenu")}>
            <button type="button" role="menuitem" onClick={() => runFromMenu(() => zoomFit(editor))}>
              <span>{t("zoomFit")}</span>
              <span className="relay-board-menu-key">Shift 1</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runFromMenu(() => zoomReset(editor))}>
              <span>{t("zoomReset")}</span>
              <span className="relay-board-menu-key">Shift 0</span>
            </button>
            <span className="relay-board-menu-sep" aria-hidden />
            <button
              type="button"
              role="menuitemcheckbox"
              data-map
              aria-checked={mapOpen}
              onClick={() => runFromMenu(() => setMapOpen((v) => !v))}
            >
              <span>{t("map")}</span>
              <span className="relay-board-menu-mark">{mapOpen ? <IconCheck /> : null}</span>
            </button>
          </div>
        ) : null}

        <div className="relay-board-dock-bar" role="toolbar" aria-label={t("dockAria")}>
          <button
            type="button"
            className="relay-board-dock-icon"
            aria-label={t("zoomOut")}
            title={t("zoomOut")}
            onClick={() => zoomOut(editor)}
            {...holdOut}
          >
            <IconMinus />
          </button>

          {editingZoom ? (
            <input
              className="relay-board-dock-input"
              value={zoomDraft}
              onChange={(ev) => setZoomDraft(ev.target.value)}
              onBlur={applyZoomDraft}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") applyZoomDraft();
                if (ev.key === "Escape") {
                  ev.preventDefault();
                  ev.stopPropagation();
                  setZoomDraft(formatZoom(editor.camera.z));
                  setEditingZoom(false);
                }
              }}
              autoFocus
              aria-label={t("zoomEdit")}
            />
          ) : (
            <div className="relay-board-dock-zoom">
              <button
                type="button"
                className="relay-board-dock-pct"
                onClick={() => {
                  setMenuOpen(false);
                  setZoomDraft(formatZoom(editor.camera.z));
                  setEditingZoom(true);
                }}
                title={t("zoomEdit")}
                aria-label={t("zoomEdit")}
              >
                {formatZoom(zoom)}
              </button>
              <button
                type="button"
                className="relay-board-dock-menu-btn"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={t("zoomMenu")}
                aria-label={t("zoomMenu")}
              >
                <IconChevron />
              </button>
            </div>
          )}

          <button
            type="button"
            className="relay-board-dock-icon"
            aria-label={t("zoomIn")}
            title={t("zoomIn")}
            onClick={() => zoomIn(editor)}
            {...holdIn}
          >
            <IconPlus />
          </button>
        </div>
      </div>

      <div className="relay-board-cursors" aria-hidden>
        {peers.map((peer) => {
          const pos = editor.pageToScreen(peer.x, peer.y);
          return (
            <div
              key={peer.userId}
              className="relay-board-cursor"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                ["--cursor-color" as string]: peer.color,
              }}
            >
              <svg className="relay-board-cursor-icon" viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M4 3l14 8.5-6.2 1.4L9.5 21 4 3z"
                  fill="var(--cursor-color)"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth="1"
                />
              </svg>
              <span className="relay-board-cursor-label">{peer.name}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
