import { getPageForUser } from "@/domain/pages/repo";
import { requireWorkspaceAccess } from "@/domain/access";
import { ApiError } from "@/lib/errors";

export type BoardRoom =
  | { kind: "workspace"; workspaceId: string }
  | { kind: "page"; pageId: string };

export function parseBoardRoomId(room: string): BoardRoom | null {
  if (room.startsWith("ws-")) return { kind: "workspace", workspaceId: room.slice(3) };
  if (room.startsWith("pg-")) return { kind: "page", pageId: room.slice(3) };
  return null;
}

export async function requireBoardRoomAccess(
  userId: string,
  room: string,
  write: boolean,
): Promise<BoardRoom> {
  const parsed = parseBoardRoomId(room);
  if (!parsed) throw new ApiError(400, "bad_request", "Invalid board room");

  if (parsed.kind === "workspace") {
    await requireWorkspaceAccess(userId, parsed.workspaceId, write ? "write" : "read");
    return parsed;
  }

  const found = await getPageForUser(userId, parsed.pageId);
  if (!found) throw new ApiError(404, "not_found", "Not found");
  if (write && found.role !== "owner" && found.role !== "editor") {
    throw new ApiError(403, "forbidden", "Insufficient permissions");
  }
  return parsed;
}
