import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userChecklist } from "@/db/schema";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getEffectivePlan } from "@/domain/billing/entitlements";
import { listWorkspacesForUser } from "@/domain/workspaces/list";

export async function GET() {
  try {
    const user = await requireSession();
    const ws = await listWorkspacesForUser(user.id);

    const checklistRows = await db
      .select()
      .from(userChecklist)
      .where(eq(userChecklist.userId, user.id))
      .limit(1);

    const plan = await getEffectivePlan(user.id);

    return json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        onboardingIntent: user.onboardingIntent,
        onboardingCompletedAt: user.onboardingCompletedAt,
      },
      workspaces: ws,
      checklist: checklistRows[0] ?? null,
      subscription: {
        plan: plan.plan,
        status: plan.status,
        trialEndsAt: plan.trialEndsAt,
        isPro: plan.isPro,
        limits: plan.limits,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
