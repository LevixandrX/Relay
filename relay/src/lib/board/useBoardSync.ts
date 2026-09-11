"use client";

import { useEffect, useRef, useState } from "react";
import type { Diff, Editor, Snapshot, Store } from "@quickdrawjs/core";
import { loadBoardSnapshot } from "@/lib/board/snapshot";
import { fetchBoardSyncTicket, type BoardPeer } from "@/lib/board/sync-shared";

function syncUrl() {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_BOARD_SYNC_URL ?? "ws://127.0.0.1:3001";
}

type SyncOptions = {
  enabled: boolean;
  write: boolean;
  selfId?: string;
  bearer?: string;
};

const TICKET_REFRESH_MS = 95_000;
const RECONNECT_MS = 3_000;
const PRESENCE_MS = 48;

export function useBoardSync(
  store: Store | null,
  editor: Editor | null,
  roomId: string | undefined,
  options: SyncOptions,
) {
  const { enabled, write, selfId, bearer } = options;
  const [peers, setPeers] = useState<BoardPeer[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!store || !roomId || !enabled) {
      setPeers([]);
      setConnected(false);
      return;
    }

    const room = roomId;
    const activeStore = store;

    const url = syncUrl();
    if (!url) return;

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let ticketTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubDiff: (() => void) | undefined;
    let unsubSnap: (() => void) | undefined;
    let snapTimer: ReturnType<typeof setTimeout> | undefined;

    const attachWriters = (ws: WebSocket) => {
      if (!write) return;
      unsubDiff = activeStore.listen(
        (diff) => {
          if (closed || ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: "diff", data: diff }));
        },
        { source: "user" },
      );
      unsubSnap = activeStore.listen(
        () => {
          clearTimeout(snapTimer);
          snapTimer = setTimeout(() => {
            if (closed || ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({ type: "snapshot", data: activeStore.getSnapshot() }));
          }, 2000);
        },
        { source: "user" },
      );
    };

    const detachWriters = () => {
      unsubDiff?.();
      unsubSnap?.();
      unsubDiff = undefined;
      unsubSnap = undefined;
      clearTimeout(snapTimer);
    };

    async function connect() {
      detachWriters();
      wsRef.current?.close();

      try {
        const token = await fetchBoardSyncTicket(room, write, bearer);
        if (closed) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (closed) {
            ws.close();
            return;
          }
          setConnected(true);
          ws.send(JSON.stringify({ type: "join", room, token }));
          attachWriters(ws);
          clearTimeout(ticketTimer);
          ticketTimer = setTimeout(() => ws.close(), TICKET_REFRESH_MS);
        };

        ws.onmessage = (event) => {
          let msg: {
            type?: string;
            data?: Diff | Snapshot;
            peers?: BoardPeer[];
            userId?: string;
            name?: string;
            color?: string;
            x?: number;
            y?: number;
          };
          try {
            msg = JSON.parse(String(event.data));
          } catch {
            return;
          }

          if (msg.type === "snapshot" && msg.data) {
            loadBoardSnapshot(activeStore, msg.data);
          } else if (msg.type === "diff" && msg.data) {
            try {
              activeStore.applyDiff(msg.data as Diff, "remote");
            } catch {
              // ignore malformed peer diff
            }
          } else if (msg.type === "peers" && Array.isArray(msg.peers)) {
            setPeers(msg.peers.filter((p) => p.userId !== selfId));
          } else if (
            msg.type === "presence" &&
            msg.userId &&
            msg.userId !== selfId &&
            typeof msg.x === "number" &&
            typeof msg.y === "number"
          ) {
            setPeers((prev) => {
              const idx = prev.findIndex((p) => p.userId === msg.userId);
              const next: BoardPeer = {
                userId: msg.userId!,
                name: msg.name ?? "Relay",
                color: msg.color ?? "hsl(210 62% 52%)",
                x: msg.x!,
                y: msg.y!,
              };
              if (idx === -1) return [...prev, next];
              const copy = [...prev];
              copy[idx] = next;
              return copy;
            });
          } else if (msg.type === "leave" && msg.userId) {
            setPeers((prev) => prev.filter((p) => p.userId !== msg.userId));
          }
        };

        ws.onclose = () => {
          setConnected(false);
          detachWriters();
          if (wsRef.current === ws) wsRef.current = null;
          if (!closed) {
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => void connect(), RECONNECT_MS);
          }
        };
      } catch {
        if (!closed) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => void connect(), RECONNECT_MS);
        }
      }
    }

    void connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(ticketTimer);
      detachWriters();
      wsRef.current?.close();
      wsRef.current = null;
      setPeers([]);
      setConnected(false);
    };
  }, [store, roomId, enabled, write, selfId, bearer]);

  useEffect(() => {
    if (!editor || !connected) return;

    const el = editor.container;
    let lastSent = 0;
    let pending: { x: number; y: number } | null = null;
    let raf = 0;

    const flush = () => {
      raf = 0;
      const ws = wsRef.current;
      if (!pending || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "presence", x: pending.x, y: pending.y }));
      pending = null;
      lastSent = performance.now();
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const p = editor.screenToPage(e.clientX - rect.left, e.clientY - rect.top);
      pending = p;
      if (performance.now() - lastSent >= PRESENCE_MS) {
        flush();
      } else if (!raf) {
        raf = requestAnimationFrame(flush);
      }
    };

    const onLeave = () => {
      pending = null;
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [editor, connected]);

  return { peers, connected };
}
