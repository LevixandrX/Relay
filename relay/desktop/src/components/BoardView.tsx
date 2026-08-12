import { useState } from "react";
import { useTranslations } from "use-intl";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { useWorkspace } from "../lib/workspace";
import type { BoardSnapshot } from "../lib/types";

export function BoardView() {
  const t = useTranslations("desktop");
  const ta = useTranslations("app");
  const { workspaceBoard, setWorkspaceBoard, mode, offline } = useWorkspace();
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");

  function onChange(board: BoardSnapshot) {
    setSaveState("saving");
    void setWorkspaceBoard(board).then(() => setSaveState("saved"));
  }

  return (
    <div className="workspace-fill">
      <div className="toprow workspace-bar">
        <div className="page-title">
          <h1>{ta("infiniteBoard")}</h1>
          <span className="badge">
            <span className="dot" />
            {offline
              ? t("statusOffline")
              : saveState === "saving"
                ? t("statusSaving")
                : mode === "cloud"
                  ? t("statusCloud")
                  : t("statusLocal")}
          </span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {t("boardHint")}
        </p>
      </div>
      <div className="board-wrap">
        <InfiniteBoard
          key={`workspace-board-${mode}`}
          initialSnapshot={workspaceBoard}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
