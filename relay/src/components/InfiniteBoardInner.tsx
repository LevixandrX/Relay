"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  Quickdraw,
  useQuickdrawStore,
  type QuickdrawRef,
} from "@quickdrawjs/react";
import "@quickdrawjs/core/quickdraw.css";
import { useBoardSync } from "@/lib/board/useBoardSync";
import { parseQuickdrawSnapshot } from "@/lib/board/snapshot";
import type { BoardSnapshot } from "./InfiniteBoard";

type Props = {
  editable?: boolean;
  initialSnapshot?: BoardSnapshot | null;
  onChange?: (snapshot: BoardSnapshot) => void;
  syncRoomId?: string;
};

export default function InfiniteBoardInner({
  editable = true,
  initialSnapshot,
  onChange,
  syncRoomId,
}: Props) {
  const store = useQuickdrawStore(parseQuickdrawSnapshot(initialSnapshot));
  const ref = useRef<QuickdrawRef>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  useBoardSync(store, syncRoomId, editable && Boolean(syncRoomId));

  const persist = useCallback(() => {
    if (!onChangeRef.current) return;
    try {
      onChangeRef.current(store.getSnapshot() as unknown as BoardSnapshot);
    } catch (err) {
      console.error("board persist failed", err);
    }
  }, [store]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = store.listen(
      () => {
        clearTimeout(timer);
        timer = setTimeout(persist, 900);
      },
      { source: "user" },
    );
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [store, persist]);

  useEffect(() => {
    ref.current?.editor?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const bump = () => window.dispatchEvent(new Event("resize"));
    bump();
    const ro = new ResizeObserver(bump);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relay-board" ref={hostRef}>
      <Quickdraw
        ref={ref}
        store={store}
        theme={theme}
        grid="dots"
        readonly={!editable}
        watermark={false}
        themeToggle={false}
        autoFit
        onMount={(editor) => {
          editor.setTheme(theme);
        }}
      />
    </div>
  );
}
