/**
 * Quickdraw multiplayer relay — forwards diffs between tabs/clients in a room.
 * Run: npm run board:sync  (port BOARD_SYNC_PORT or 3001)
 */
import { WebSocketServer } from "ws";

const port = Number(process.env.BOARD_SYNC_PORT || 3001);
/** @type {Map<string, { clients: Set<import('ws').WebSocket>, snapshot: unknown }>} */
const rooms = new Map();

function roomOf(id) {
  if (!rooms.has(id)) rooms.set(id, { clients: new Set(), snapshot: null });
  return rooms.get(id);
}

const wss = new WebSocketServer({ port });

wss.on("connection", (ws, req) => {
  const q = new URL(req.url || "", "http://local").searchParams;
  let roomId = q.get("room") || "";
  let joined = false;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join" && msg.room) {
      roomId = String(msg.room);
      joined = true;
      const room = roomOf(roomId);
      room.clients.add(ws);
      if (room.snapshot) {
        ws.send(JSON.stringify({ type: "snapshot", data: room.snapshot }));
      }
      return;
    }

    if (!joined || !roomId) return;
    const room = roomOf(roomId);

    if (msg.type === "diff" && msg.data) {
      const payload = JSON.stringify({ type: "diff", data: msg.data });
      for (const peer of room.clients) {
        if (peer !== ws && peer.readyState === 1) peer.send(payload);
      }
    } else if (msg.type === "snapshot" && msg.data) {
      room.snapshot = msg.data;
    }
  });

  ws.on("close", () => {
    if (!roomId) return;
    roomOf(roomId).clients.delete(ws);
  });
});

console.log(`[relay] board sync ws://127.0.0.1:${port}`);
