import { useEffect, useRef, useState } from "react";
import { useSaveFeedback } from "@relay-ui/SaveIndicator";
import { useSaveBatch } from "../../../src/lib/use-save-batch";
import { useTranslations } from "use-intl";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { WorkspacePresence } from "./WorkspacePresence";
import type { BoardSnapshot } from "../lib/types";
import { clearActivityFocus, readActivityFocus, subscribeActivityFocus } from "@relay-board/activity-focus";

export function BoardView() {
  const ta = useTranslations("app");
  const { workspaceBoard, setWorkspaceBoard, mode, activeWorkspaceId } = useWorkspace();
  const auth = useAuth();
  const [saveState, setSaveState, saveRevision] = useSaveFeedback();
  const batch = useSaveBatch<{ readBoard: () => BoardSnapshot }>(`${mode}:${activeWorkspaceId}`);
  const currentBatch = useRef(batch);
  currentBatch.current = batch;
  const [focusShapeIds, setFocusShapeIds] = useState<string[]>([]);
  const focusTimer = useRef<number | null>(null);
  useEffect(() => {
    const focus = readActivityFocus(null);
    if (!focus) return;
    setFocusShapeIds(focus.shapeIds);
    clearActivityFocus();
    focusTimer.current = window.setTimeout(() => setFocusShapeIds([]), 5000);
    return () => {
      if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
    };
  }, []);
  useEffect(
    () =>
      subscribeActivityFocus((focus) => {
        if (focus.pageId !== null) return;
        setFocusShapeIds(focus.shapeIds);
        clearActivityFocus();
        if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
        focusTimer.current = window.setTimeout(() => setFocusShapeIds([]), 5000);
      }),
    [],
  );
  useEffect(() => {
    if (mode !== "cloud" || !auth.token || !activeWorkspaceId) return;
    void api(`/workspaces/${activeWorkspaceId}/views`, {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ pageId: null }),
    }).catch(() => undefined);
  }, [mode, auth.token, activeWorkspaceId]);

  useEffect(() => {
    function onRestored(event: Event) {
      const pageId = (event as CustomEvent<{ pageId?: string | null }>).detail?.pageId;
      if (pageId) return;
      batch.discardPending();
      window.location.reload();
    }
    window.addEventListener("relay:history-restored", onRestored);
    return () => window.removeEventListener("relay:history-restored", onRestored);
  }, [batch]);

  function onChange(readBoard: () => BoardSnapshot) {
    batch.stage({ readBoard }, async ({ readBoard }) => {
      if (currentBatch.current === batch) setSaveState("saving");
      try {
        await setWorkspaceBoard(readBoard());
        if (currentBatch.current === batch) setSaveState("saved");
      } catch (error) {
        if (currentBatch.current === batch) setSaveState("error");
        throw error;
      }
    });
  }

  return (
    <div className="workspace-fill">
      <div className="toprow workspace-bar">
        <div className="page-title">
          <h1>{ta("infiniteBoard")}</h1>
          <WorkspacePresence save={saveState} revision={saveRevision} />
        </div>
      </div>
      <div className="board-wrap">
        <InfiniteBoard
          key={`workspace-board-${mode}-${activeWorkspaceId}`}
          initialSnapshot={workspaceBoard}
          syncRoomId={mode === "cloud" && activeWorkspaceId ? `ws-${activeWorkspaceId}` : undefined}
          onChange={onChange}
          focusShapeIds={focusShapeIds}
        />
      </div>
    </div>
  );
}
