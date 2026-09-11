export type BoardPeer = {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
};

export type BoardSyncUser = {
  id: string;
  name: string;
};

export {
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_MIN,
  formatZoom,
  zoomFit,
  zoomIn,
  zoomOut,
  zoomReset,
} from "./board-navigator";

export function peerColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 62% 52%)`;
}

export async function fetchBoardSyncTicket(room: string, write: boolean, bearer?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const res = await fetch("/api/v1/board/sync-ticket", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ room, write }),
  });
  if (!res.ok) throw new Error("board sync ticket denied");
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("board sync ticket missing");
  return data.token;
}
