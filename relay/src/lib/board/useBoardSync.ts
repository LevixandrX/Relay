"use client";

import { useEffect } from "react";
import type { Diff, Snapshot, Store } from "@quickdrawjs/core";

function syncUrl() {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_BOARD_SYNC_URL ?? "ws://127.0.0.1:3001";
}

type SyncMsg =
  | { type: "join"; room: string }
  | { type: "diff"; room: string; data: Diff }
  | { type: "snapshot"; room: string; data: Snapshot };

/** Live board relay — peers in the same room share Quickdraw diffs. */
export function useBoardSync(store: Store | null, roomId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!store || !roomId || !enabled) return;

    const url = syncUrl();
    if (!url) return;

    const ws = new WebSocket(`${url}?room=${encodeURIComponent(roomId)}`);
    let closed = false;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room: roomId } satisfies SyncMsg));
    };

    ws.onmessage = (event) => {
      let msg: { type?: string; data?: Diff | Snapshot };
      try {
        msg = JSON.parse(String(event.data)) as { type?: string; data?: Diff | Snapshot };
      } catch {
        return;
      }
      if (msg.type === "snapshot" && msg.data) {
        store.loadSnapshot(msg.data as Snapshot, "remote");
      } else if (msg.type === "diff" && msg.data) {
        store.applyDiff(msg.data as Diff, "remote");
      }
    };

    const unsubDiff = store.listen(
      (diff) => {
        if (closed || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "diff", room: roomId, data: diff } satisfies SyncMsg));
      },
      { source: "user" },
    );

    let snapTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubSnap = store.listen(
      () => {
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
          if (closed || ws.readyState !== WebSocket.OPEN) return;
          ws.send(
            JSON.stringify({
              type: "snapshot",
              room: roomId,
              data: store.getSnapshot(),
            } satisfies SyncMsg),
          );
        }, 2000);
      },
      { source: "user" },
    );

    return () => {
      closed = true;
      unsubDiff();
      unsubSnap();
      clearTimeout(snapTimer);
      ws.close();
    };
  }, [store, roomId, enabled]);
}
