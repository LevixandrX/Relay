import { useState } from "react";
import { useTranslations } from "use-intl";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { WorkspacePresence } from "./WorkspacePresence";
import { VersionHistory } from "@relay-history";
import type { BoardSnapshot } from "../lib/types";

export function BoardView() {
  const ta = useTranslations("app");
  const { workspaceBoard, setWorkspaceBoard, mode, activeWorkspaceId } = useWorkspace();
  const auth = useAuth();
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [historyOpen, setHistoryOpen] = useState(false);

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
        {mode === "cloud" && activeWorkspaceId && auth.token ? (
          <button type="button" className="btn" onClick={() => setHistoryOpen(true)}>
            {ta("pageMenuHistory")}
          </button>
        ) : null}
      </div>
      <div className="board-wrap">
        <InfiniteBoard
          key={`workspace-board-${mode}`}
          initialSnapshot={workspaceBoard}
          syncRoomId={mode === "cloud" && activeWorkspaceId ? `ws-${activeWorkspaceId}` : undefined}
          onChange={onChange}
        />
      </div>
      {mode === "cloud" && activeWorkspaceId && auth.token ? (
        <VersionHistory
          open={historyOpen}
          title={ta("infiniteBoard")}
          canRestore
          client={{
            list: () =>
              api(`/workspaces/${activeWorkspaceId}/board/revisions`, { token: auth.token }),
            get: (id) =>
              api(`/workspaces/${activeWorkspaceId}/board/revisions/${id}`, { token: auth.token }),
            restore: async (id) => {
              await api(`/workspaces/${activeWorkspaceId}/board/revisions/${id}/restore`, {
                method: "POST",
                token: auth.token,
              });
            },
          }}
          onClose={() => setHistoryOpen(false)}
          onRestored={() => window.location.reload()}
        />
      ) : null}
    </div>
  );
}
