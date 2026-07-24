import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { now } from "@/lib/ids";

export async function writeAudit(input: {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    workspaceId: input.workspaceId,
    actorId: input.actorId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    meta: input.meta ? JSON.stringify(input.meta) : null,
    createdAt: now(),
  });
}
