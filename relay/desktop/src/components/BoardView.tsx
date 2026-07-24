import { useState } from "react";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { useWorkspace } from "../lib/workspace";
import type { BoardSnapshot } from "../lib/types";

export function BoardView() {
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
          <h1>Бесконечный холст</h1>
          <span className="badge">
            <span className="dot" />
            {offline
              ? "Офлайн"
              : saveState === "saving"
                ? "Сохранение…"
                : mode === "cloud"
                  ? "Облако"
                  : "Локально"}
          </span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Колёсико — масштаб · пробел + тяни — панорама
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
