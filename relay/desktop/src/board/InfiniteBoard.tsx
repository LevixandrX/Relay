import { useEffect, useRef, useState } from "react";
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
import { useBoardActivityFocus } from "@relay-board/useBoardActivityFocus";
import { useBoardChanges } from "@relay-board/use-board-changes";

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
  getDraft?: () => BoardSnapshot | undefined;
  onChange?: (readSnapshot: () => BoardSnapshot) => void;
  syncRoomId?: string;
  focusShapeIds?: string[];
};

export function InfiniteBoard({
  editable = true,
  initialSnapshot,
  getDraft,
  onChange,
  syncRoomId,
  focusShapeIds,
}: Props) {
  const [snapshot] = useState(() => parseQuickdrawSnapshot(getDraft?.() ?? initialSnapshot));
  const store = useQuickdrawStore(snapshot);
  const ref = useRef<QuickdrawRef>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useBoardTheme();
  const [editor, setEditor] = useState<Editor | null>(null);
  const activityFocusRect = useBoardActivityFocus(editor, focusShapeIds);
  const { token, user } = useAuth();

  const { peers } = useBoardSync(store, editor, syncRoomId, {
    enabled: Boolean(syncRoomId && token),
    write: editable,
    selfId: user?.id,
    bearer: token,
  });

  useBoardViewportInput(editor, hostRef);

  useBoardChanges(store, editable ? onChange : undefined);

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
      {activityFocusRect ? (
        <div
          className="relay-board-activity-focus"
          data-visible={activityFocusRect.visible || undefined}
          style={{
            left: activityFocusRect.left,
            top: activityFocusRect.top,
            width: activityFocusRect.width,
            height: activityFocusRect.height,
          }}
          aria-hidden
        />
      ) : null}
      {editor ? <BoardChrome editor={editor} peers={peers} dark={theme === "dark"} /> : null}
    </div>
  );
}
