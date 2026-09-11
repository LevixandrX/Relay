import { API_URL } from "./api";

export type BoardPeer = {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
};

export {
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_MIN,
  formatZoom,
  zoomFit,
  zoomIn,
  zoomOut,
  zoomReset,
} from "@relay-board/board-navigator";

export async function fetchBoardSyncTicket(room: string, write: boolean, bearer?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const res = await fetch(`${API_URL}/api/v1/board/sync-ticket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ room, write }),
  });
  if (!res.ok) throw new Error("board sync ticket denied");
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("board sync ticket missing");
  return data.token;
}
