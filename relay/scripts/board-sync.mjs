/**
 * Quickdraw multiplayer relay with JWT room tickets + live cursors.
 */
import { WebSocketServer } from "ws";
import { config as loadEnv } from "dotenv";
import { jwtVerify } from "jose";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(root, ".env.local") });

const port = Number(process.env.BOARD_SYNC_PORT || 3001);

function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    console.error("[relay] AUTH_SECRET missing — board sync refuses connections");
    process.exit(1);
  }
  return new TextEncoder().encode(s);
}

/** @type {Map<string, { clients: Set<import('ws').WebSocket>, snapshot: unknown }>} */
const rooms = new Map();

function roomOf(id) {
  if (!rooms.has(id)) rooms.set(id, { clients: new Set(), snapshot: null });
  return rooms.get(id);
}

function peerColor(userId) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 62% 52%)`;
}

async function verifyTicket(token, room) {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const ticketRoom = typeof payload.room === "string" ? payload.room : null;
    if (!userId || ticketRoom !== room) return null;
    return {
      userId,
      userName: typeof payload.name === "string" ? payload.name : "Relay",
      write: payload.write === true,
      color: peerColor(userId),
    };
  } catch {
    return null;
  }
}

function broadcast(roomId, payload, except) {
  const room = roomOf(roomId);
  const raw = JSON.stringify(payload);
  for (const peer of room.clients) {
    if (peer !== except && peer.readyState === 1) peer.send(raw);
  }
}

function roster(roomId) {
  const room = roomOf(roomId);
  const out = [];
  for (const ws of room.clients) {
    if (!ws.meta) continue;
    out.push({
      userId: ws.meta.userId,
      name: ws.meta.userName,
      color: ws.meta.color,
      x: ws.meta.x ?? 0,
      y: ws.meta.y ?? 0,
    });
  }
  return out;
}

function sendRoster(roomId) {
  const peers = roster(roomId);
  broadcast(roomId, { type: "peers", peers });
}

const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
  ws.meta = null;
  let roomId = "";
  let joined = false;

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.close(4000, "bad json");
      return;
    }

    if (msg.type === "join") {
      if (!msg.room || !msg.token) {
        ws.close(4001, "auth required");
        return;
      }
      roomId = String(msg.room);
      const auth = await verifyTicket(String(msg.token), roomId);
      if (!auth) {
        ws.close(4003, "invalid ticket");
        return;
      }
      joined = true;
      ws.meta = {
        userId: auth.userId,
        userName: auth.userName,
        color: auth.color,
        write: auth.write,
        x: 0,
        y: 0,
      };
      const room = roomOf(roomId);
      room.clients.add(ws);
      if (room.snapshot) {
        ws.send(JSON.stringify({ type: "snapshot", data: room.snapshot }));
      }
      sendRoster(roomId);
      return;
    }

    if (!joined || !roomId || !ws.meta) return;

    if (msg.type === "presence" && typeof msg.x === "number" && typeof msg.y === "number") {
      ws.meta.x = msg.x;
      ws.meta.y = msg.y;
      broadcast(
        roomId,
        {
          type: "presence",
          userId: ws.meta.userId,
          name: ws.meta.userName,
          color: ws.meta.color,
          x: msg.x,
          y: msg.y,
        },
        ws,
      );
      return;
    }

    if (!ws.meta.write) return;

    if (msg.type === "diff" && msg.data) {
      broadcast(roomId, { type: "diff", data: msg.data }, ws);
    } else if (msg.type === "snapshot" && msg.data) {
      roomOf(roomId).snapshot = msg.data;
    }
  });

  ws.on("close", () => {
    if (!roomId) return;
    roomOf(roomId).clients.delete(ws);
    if (joined && ws.meta) {
      broadcast(roomId, { type: "leave", userId: ws.meta.userId });
      sendRoster(roomId);
    }
  });
});

console.log(`[relay] board sync ws://127.0.0.1:${port}`);
