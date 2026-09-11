import { useCallback, useEffect, useRef, useState } from "react";
import {
  Quickdraw,
  useQuickdrawStore,
  type QuickdrawRef,
} from "@quickdrawjs/react";
import type { Editor } from "@quickdrawjs/core";
import "@quickdrawjs/core/quickdraw.css";
import { BoardChrome } from "@relay-board-chrome";
import { useAuth } from "../lib/auth";
import { useBoardSync } from "../lib/useBoardSync";
import { useBoardViewportInput } from "@relay-board/useBoardViewportInput";
import { applyRelayBoardTheme, paintEditorCanvas, watchCanvasBackdropSampling } from "@relay-board/canvas-theme";
import { parseQuickdrawSnapshot } from "../lib/boardSnapshot";
import { useTheme } from "../theme/ThemeProvider";
import type { BoardSnapshot } from "../lib/types";

applyRelayBoardTheme();

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
  const [editor, setEditor] = useState<Editor | null>(null);
  const { token, user } = useAuth();

  const { peers } = useBoardSync(store, editor, syncRoomId, {
    enabled: Boolean(syncRoomId && token),
    write: editable,
    selfId: user?.id,
    bearer: token,
  });

  useBoardViewportInput(editor, hostRef);

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
    applyRelayBoardTheme();
    ref.current?.editor?.setTheme(theme);
    if (editor) {
      editor.setTheme(theme);
      paintEditorCanvas(editor, theme);
    }
  }, [theme, editor]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const bump = () => window.dispatchEvent(new Event("resize"));
    bump();
    const ro = new ResizeObserver(bump);
    ro.observe(el);
    const stopWatch = watchCanvasBackdropSampling(el);
    return () => {
      ro.disconnect();
      stopWatch();
    };
  }, []);

  return (
    <div className="relay-board-host" ref={hostRef}>
      <div className="relay-board">
        <Quickdraw
          ref={ref}
          store={store}
          theme={theme}
          grid="dots"
          readonly={!editable}
          watermark={false}
          themeToggle={false}
          autoFit
          onMount={(ed) => {
            ed.setTheme(theme);
            paintEditorCanvas(ed, theme);
            setEditor(ed);
          }}
        />
      </div>
      {editor ? <BoardChrome editor={editor} peers={peers} dark={theme === "dark"} /> : null}
    </div>
  );
}
