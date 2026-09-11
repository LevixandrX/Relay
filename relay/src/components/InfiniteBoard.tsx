"use client";

import dynamic from "next/dynamic";

export type BoardSnapshot = unknown;

const BoardInner = dynamic(() => import("./InfiniteBoardInner"), {
  ssr: false,
  loading: () => <div className="relay-board-loading">Загружаем доску…</div>,
});

type Props = {
  editable?: boolean;
  initialSnapshot?: BoardSnapshot | null;
  onChange?: (snapshot: BoardSnapshot) => void;
  syncRoomId?: string;
  viewerId?: string;
};

/** Quickdraw on the client only — no SSR. */
export function InfiniteBoard(props: Props) {
  return <BoardInner {...props} />;
}
