"use client";

import dynamic from "next/dynamic";

export type BoardSnapshot = unknown;

const BoardInner = dynamic(() => import("./InfiniteBoardInner"), {
  ssr: false,
  loading: () => <div className="relay-board-loading">Загружаем холст…</div>,
});

type Props = {
  editable?: boolean;
  initialSnapshot?: BoardSnapshot | null;
  onChange?: (snapshot: BoardSnapshot) => void;
};

/** tldraw только на клиенте — без SSR. */
export function InfiniteBoard(props: Props) {
  return <BoardInner {...props} />;
}
