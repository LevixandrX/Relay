"use client";



import { useEffect, useRef, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";

import {

  Quickdraw,

  useQuickdrawStore,

  type QuickdrawRef,

} from "@quickdrawjs/react";

import type { Editor } from "@quickdrawjs/core";

import "@quickdrawjs/core/quickdraw.css";

import { BoardChrome } from "@/components/BoardChrome";

import { useBoardSync } from "@/lib/board/useBoardSync";

import { useBoardViewportInput } from "@/lib/board/useBoardViewportInput";

import { applyRelayBoardTheme, paintEditorCanvas, watchCanvasBackdropSampling } from "@/lib/board/canvas-theme";
import { parseQuickdrawSnapshot } from "@/lib/board/snapshot";
import { useBoardActivityFocus } from "@/lib/board/useBoardActivityFocus";
import { useBoardChanges } from "@/lib/board/use-board-changes";

import type { BoardSnapshot } from "./InfiniteBoard";



applyRelayBoardTheme();

type Props = {

  editable?: boolean;

  initialSnapshot?: BoardSnapshot | null;
  getDraft?: () => BoardSnapshot | undefined;
  onChange?: (readSnapshot: () => BoardSnapshot) => void;

  syncRoomId?: string;

  viewerId?: string;
  focusShapeIds?: string[];

};



export default function InfiniteBoardInner({

  editable = true,

  initialSnapshot,
  getDraft,

  onChange,

  syncRoomId,

  viewerId,
  focusShapeIds,

}: Props) {

  const [snapshot] = useState(() => parseQuickdrawSnapshot(getDraft?.() ?? initialSnapshot));
  const store = useQuickdrawStore(snapshot);

  const ref = useRef<QuickdrawRef>(null);

  const hostRef = useRef<HTMLDivElement>(null);

  const { resolvedTheme } = useTheme();

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  const [editor, setEditor] = useState<Editor | null>(null);

  const activityFocusRect = useBoardActivityFocus(editor, focusShapeIds);



  const { peers } = useBoardSync(store, editor, syncRoomId, {

    enabled: Boolean(syncRoomId),

    write: editable,

    selfId: viewerId,

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

      {editor ? (

        <BoardChrome editor={editor} peers={peers} dark={theme === "dark"} />

      ) : null}

    </div>

  );

}

