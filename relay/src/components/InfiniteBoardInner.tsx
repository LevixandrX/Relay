"use client";



import { useCallback, useEffect, useRef, useState } from "react";

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

import type { BoardSnapshot } from "./InfiniteBoard";



applyRelayBoardTheme();

type Props = {

  editable?: boolean;

  initialSnapshot?: BoardSnapshot | null;

  onChange?: (snapshot: BoardSnapshot) => void;

  syncRoomId?: string;

  viewerId?: string;

};



export default function InfiniteBoardInner({

  editable = true,

  initialSnapshot,

  onChange,

  syncRoomId,

  viewerId,

}: Props) {

  const store = useQuickdrawStore(parseQuickdrawSnapshot(initialSnapshot));

  const ref = useRef<QuickdrawRef>(null);

  const hostRef = useRef<HTMLDivElement>(null);

  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  const { resolvedTheme } = useTheme();

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  const [editor, setEditor] = useState<Editor | null>(null);



  const { peers } = useBoardSync(store, editor, syncRoomId, {

    enabled: Boolean(syncRoomId),

    write: editable,

    selfId: viewerId,

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

      {editor ? (

        <BoardChrome editor={editor} peers={peers} dark={theme === "dark"} />

      ) : null}

    </div>

  );

}

