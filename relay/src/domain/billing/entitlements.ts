import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  memberships,
  pages,
  subscriptions,
  workspaces,
  type PlanId,
  type SubStatus,
} from "@/db/schema";
import { ApiError } from "@/lib/errors";
import { now } from "@/lib/ids";

export const TRIAL_DAYS = 14;

export const LIMITS = {
  free: {
    workspaces: 1,
    pagesPerWorkspace: 20,
    membersPerWorkspace: 3,
    publishPages: 1,
  },
  pro: {
    workspaces: 50,
    pagesPerWorkspace: 10_000,
    membersPerWorkspace: 100,
    publishPages: 10_000,
  },
} as const;

export type EntitlementFeature =
  | "create_workspace"
  | "create_page"
  | "invite_member"
  | "publish_page";

export type EffectivePlan = {
  plan: PlanId;
  status: SubStatus;
  trialEndsAt: string | null;
  isPro: boolean;
  limits: (typeof LIMITS)["free"] | (typeof LIMITS)["pro"];
};

export async function ensureSubscription(userId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (rows[0]) return rows[0];

  const ts = now();
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(subscriptions).values({
    userId,
    plan: "pro",
    status: "trialing",
    trialEndsAt: trialEnds,
    currentPeriodEnd: null,
    updatedAt: ts,
    createdAt: ts,
  });
  const created = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return created[0]!;
}

export async function createTrialSubscription(userId: string) {
  await ensureSubscription(userId);
}

export async function getEffectivePlan(userId: string): Promise<EffectivePlan> {
  const sub = await ensureSubscription(userId);
  let plan = (sub.plan as PlanId) || "free";
  let status = (sub.status as SubStatus) || "active";
  const trialEndsAt = sub.trialEndsAt;

  if (status === "trialing" && trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) {
    plan = "free";
    status = "active";
    await db
      .update(subscriptions)
      .set({ plan: "free", status: "active", updatedAt: now() })
      .where(eq(subscriptions.userId, userId));
  }

  const isPro =
    status === "trialing" ||
    (plan === "pro" && status === "active");

  return {
    plan: isPro ? "pro" : "free",
    status,
    trialEndsAt,
    isPro,
    limits: isPro ? LIMITS.pro : LIMITS.free,
  };
}

export async function assertEntitlement(
  userId: string,
  feature: EntitlementFeature,
  ctx?: { workspaceId?: string },
) {
  const effective = await getEffectivePlan(userId);
  const limits = effective.limits;

  if (feature === "create_workspace") {
    const [{ value }] = await db
      .select({ value: count() })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.role, "owner"),
          isNull(workspaces.deletedAt),
        ),
      );
    if (Number(value) >= limits.workspaces) {
      throw new ApiError(
        402,
        "plan_limit",
        effective.isPro
          ? "Достигнут лимит пространств"
          : "На бесплатном плане — одно пространство. Нужен Pro.",
        { feature, limits },
      );
    }
  }

  if (feature === "create_page") {
    const wid = ctx?.workspaceId;
    if (!wid) throw new ApiError(400, "validation_error", "workspaceId required");
    const [{ value }] = await db
      .select({ value: count() })
      .from(pages)
      .where(and(eq(pages.workspaceId, wid), isNull(pages.deletedAt)));
    if (Number(value) >= limits.pagesPerWorkspace) {
      throw new ApiError(
        402,
        "plan_limit",
        `Лимит страниц: ${limits.pagesPerWorkspace}. Нужен Pro.`,
        { feature, limits },
      );
    }
  }

  if (feature === "invite_member") {
    const wid = ctx?.workspaceId;
    if (!wid) throw new ApiError(400, "validation_error", "workspaceId required");
    const [{ value }] = await db
      .select({ value: count() })
      .from(memberships)
      .where(eq(memberships.workspaceId, wid));
    if (Number(value) >= limits.membersPerWorkspace) {
      throw new ApiError(
        402,
        "plan_limit",
        `Лимит участников: ${limits.membersPerWorkspace}. Нужен Pro.`,
        { feature, limits },
      );
    }
  }

  if (feature === "publish_page") {
    const wid = ctx?.workspaceId;
    if (!wid) throw new ApiError(400, "validation_error", "workspaceId required");
    const [{ value }] = await db
      .select({ value: count() })
      .from(pages)
      .where(
        and(eq(pages.workspaceId, wid), isNull(pages.deletedAt), isNotNull(pages.publicId)),
      );
    if (Number(value) >= limits.publishPages) {
      throw new ApiError(
        402,
        "plan_limit",
        `Лимит публичных страниц: ${limits.publishPages}. Нужен Pro.`,
        { feature, limits },
      );
    }
  }
}
