import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  getSnapshot,
  loadSnapshot,
  type Editor,
  type TLEditorSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";
import type { BoardSnapshot } from "../lib/types";

type Props = {
  editable?: boolean;
  initialSnapshot?: BoardSnapshot | null;
  onChange?: (snapshot: BoardSnapshot) => void;
};

export function InfiniteBoard({
  editable = true,
  initialSnapshot,
  onChange,
}: Props) {
  const editorRef = useRef<Editor | null>(null);
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const persist = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !onChangeRef.current) return;
    try {
      onChangeRef.current(getSnapshot(editor.store) as unknown as BoardSnapshot);
    } catch (err) {
      console.error("board persist failed", err);
    }
  }, []);

  useEffect(() => {
    if (!ready || !editorRef.current) return;
    editorRef.current.updateInstanceState({ isReadonly: !editable });
  }, [editable, ready]);

  return (
    <div className="relay-board">
      <Tldraw
        onMount={(editor) => {
          editorRef.current = editor;
          if (initialSnapshot && !loadedRef.current) {
            try {
              loadSnapshot(editor.store, initialSnapshot as unknown as TLEditorSnapshot);
            } catch {
              // empty canvas
            }
            loadedRef.current = true;
          }
          editor.updateInstanceState({ isReadonly: !editable });
          setReady(true);

          let timer: ReturnType<typeof setTimeout> | undefined;
          const unsub = editor.store.listen(
            () => {
              clearTimeout(timer);
              timer = setTimeout(persist, 900);
            },
            { source: "user", scope: "document" },
          );
          return () => {
            clearTimeout(timer);
            unsub();
            editorRef.current = null;
          };
        }}
      />
    </div>
  );
}
