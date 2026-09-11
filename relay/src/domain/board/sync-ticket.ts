import { SignJWT, jwtVerify } from "jose";
import { requireBoardRoomAccess } from "@/domain/board/sync-access";

const TTL_SEC = 120;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function createBoardSyncTicket(input: {
  userId: string;
  userName: string | null;
  room: string;
  write: boolean;
}) {
  await requireBoardRoomAccess(input.userId, input.room, input.write);
  return new SignJWT({
    room: input.room,
    write: input.write,
    name: input.userName?.trim() || "Relay",
  })
    .setSubject(input.userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secret());
}

export type VerifiedBoardSyncTicket = {
  userId: string;
  userName: string;
  room: string;
  write: boolean;
};

export async function verifyBoardSyncTicket(
  token: string,
  room: string,
): Promise<VerifiedBoardSyncTicket | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const ticketRoom = typeof payload.room === "string" ? payload.room : null;
    if (!userId || !ticketRoom || ticketRoom !== room) return null;
    return {
      userId,
      userName: typeof payload.name === "string" ? payload.name : "Relay",
      room: ticketRoom,
      write: payload.write === true,
    };
  } catch {
    return null;
  }
}
