import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, type Role } from "@/db/schema";
import { ApiError } from "@/lib/errors";

export type Action = "read" | "write" | "manage";

const ALLOWED: Record<Role, Action[]> = {
  owner: ["read", "write", "manage"],
  editor: ["read", "write"],
  viewer: ["read"],
};

export async function requireWorkspaceAccess(
  userId: string | null,
  workspaceId: string,
  action: Action,
): Promise<Role> {
  if (!userId) throw new ApiError(401, "unauthorized", "Sign in required");
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);
  const m = rows[0];
  if (!m) throw new ApiError(404, "not_found", "Not found");
  const role = m.role as Role;
  if (!ALLOWED[role]?.includes(action)) {
    throw new ApiError(403, "forbidden", "Insufficient permissions");
  }
  return role;
}

export function can(role: Role, action: Action) {
  return ALLOWED[role]?.includes(action) ?? false;
}
