import { useCallback, useEffect, useRef, useState } from "react";
import {
  Quickdraw,
  useQuickdrawStore,
  type QuickdrawRef,
} from "@quickdrawjs/react";
import "@quickdrawjs/core/quickdraw.css";
import { useBoardSync } from "../lib/useBoardSync";
import { parseQuickdrawSnapshot } from "../lib/boardSnapshot";
import { useTheme } from "../theme/ThemeProvider";
import type { BoardSnapshot } from "../lib/types";

function useBoardTheme(): "light" | "dark" {
  const { mode } = useTheme();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const read = () => {
      const effective =
        mode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : mode;
      setTheme(effective);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, [mode]);

  return theme;
}

type Props = {
  editable?: boolean;
  initialSnapshot?: BoardSnapshot | null;
  onChange?: (snapshot: BoardSnapshot) => void;
  syncRoomId?: string;
};

export function InfiniteBoard({
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
  const theme = useBoardTheme();

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
