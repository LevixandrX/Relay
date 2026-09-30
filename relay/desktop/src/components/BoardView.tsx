import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { WorkspacePresence } from "./WorkspacePresence";
import type { BoardSnapshot } from "../lib/types";

export function BoardView() {
  const ta = useTranslations("app");
  const { workspaceBoard, setWorkspaceBoard, mode, activeWorkspaceId } = useWorkspace();
  const auth = useAuth();
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
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
      window.location.reload();
    }
    window.addEventListener("relay:history-restored", onRestored);
    return () => window.removeEventListener("relay:history-restored", onRestored);
  }, []);

  function onChange(board: BoardSnapshot) {
    setSaveState("saving");
    void setWorkspaceBoard(board).then(() => setSaveState("saved"));
  }

  return (
    <div className="workspace-fill">
      <div className="toprow workspace-bar">
        <div className="page-title">
          <h1>{ta("infiniteBoard")}</h1>
          <WorkspacePresence save={saveState} />
        </div>
      </div>
      <div className="board-wrap">
        <InfiniteBoard
          key={`workspace-board-${mode}`}
          initialSnapshot={workspaceBoard}
          syncRoomId={mode === "cloud" && activeWorkspaceId ? `ws-${activeWorkspaceId}` : undefined}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
