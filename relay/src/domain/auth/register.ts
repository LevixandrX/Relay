import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, userChecklist, users, workspaces } from "@/db/schema";
import { id, now, slugify } from "@/lib/ids";
import { createPage } from "@/domain/pages/repo";
import {
  starterPagesForIntent,
  type Intent,
} from "@/domain/onboarding/templates";
import { writeAudit } from "@/domain/audit";
import { createTrialSubscription } from "@/domain/billing/entitlements";

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  intent?: Intent;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    throw new Error("EMAIL_TAKEN");
  }

  const userId = id.user();
  const ts = now();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const intent = input.intent ?? "write";

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name: input.name.trim() || email.split("@")[0],
    onboardingIntent: intent,
    createdAt: ts,
  });

  await db.insert(userChecklist).values({
    userId,
    editedPage: false,
    usedSlashOrPrompt: false,
    openedShare: false,
    dismissed: false,
    updatedAt: ts,
  });

  await createTrialSubscription(userId);

  const wsId = id.workspace();
  const wsName = "Моё пространство";
  await db.insert(workspaces).values({
    id: wsId,
    name: wsName,
    slug: slugify(wsName),
    createdBy: userId,
    createdAt: ts,
  });
  await db.insert(memberships).values({
    id: id.membership(),
    workspaceId: wsId,
    userId,
    role: "owner",
    createdAt: ts,
  });

  const starters = starterPagesForIntent(intent);
  let firstPageId: string | null = null;
  for (let i = 0; i < starters.length; i++) {
    const s = starters[i];
    const pageId = await createPage({
      userId,
      workspaceId: wsId,
      title: s.title,
      icon: s.icon,
      content: s.doc,
      position: (i + 1) * 1000,
    });
    if (!firstPageId) firstPageId = pageId;
  }

  await writeAudit({
    workspaceId: wsId,
    actorId: userId,
    action: "workspace.create",
    targetType: "workspace",
    targetId: wsId,
  });

  return { userId, workspaceId: wsId, firstPageId };
}

export async function verifyLogin(email: string, password: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  const user = rows[0];
  if (!user?.passwordHash || user.passwordHash.length < 20) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}
