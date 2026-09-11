import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userChecklist } from "@/db/schema";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getEffectivePlan } from "@/domain/billing/entitlements";
import { listWorkspacesForUser } from "@/domain/workspaces/list";
import {
  listLinkedProviders,
  updateProfile,
  userHasPassword,
} from "@/domain/auth/profile";

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
    const providers = await listLinkedProviders(user.id);

    return json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        onboardingIntent: user.onboardingIntent,
        onboardingCompletedAt: user.onboardingCompletedAt,
        providers,
        hasPassword: userHasPassword(user),
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

export async function PATCH(req: Request) {
  try {
    const user = await requireSession();
    const body = z
      .object({
        name: z.string().min(1).max(80).optional(),
        avatarUrl: z.string().max(140_000).nullable().optional(),
      })
      .parse(await req.json());
    await updateProfile(user.id, body);
    const next = await requireSession();
    const providers = await listLinkedProviders(next.id);
    return json({
      user: {
        id: next.id,
        email: next.email,
        name: next.name,
        avatarUrl: next.avatarUrl,
        providers,
        hasPassword: userHasPassword(next),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
