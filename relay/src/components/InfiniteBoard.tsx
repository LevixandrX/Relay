"use client";

import dynamic from "next/dynamic";
import { LoadingIndicator } from "./LoadingIndicator";

export type BoardSnapshot = unknown;

const BoardInner = dynamic(() => import("./InfiniteBoardInner"), {
  ssr: false,
  loading: () => <LoadingIndicator centered />,
});

type Props = {
  editable?: boolean;
  initialSnapshot?: BoardSnapshot | null;
  getDraft?: () => BoardSnapshot | undefined;
  onChange?: (readSnapshot: () => BoardSnapshot) => void;
  syncRoomId?: string;
  viewerId?: string;
  focusShapeIds?: string[];
};

/** Quickdraw on the client only — no SSR. */
export function InfiniteBoard(props: Props) {
  return <BoardInner {...props} />;
}
