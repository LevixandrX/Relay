import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userChecklist, users } from "@/db/schema";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { now } from "@/lib/ids";

export async function PATCH(req: Request) {
  try {
    const user = await requireSession();
    const body = z
      .object({
        key: z.enum(["edited_page", "used_slash_or_prompt", "opened_share", "dismissed"]),
      })
      .parse(await req.json());

    const patch: Record<string, unknown> = { updatedAt: now() };
    if (body.key === "edited_page") patch.editedPage = true;
    if (body.key === "used_slash_or_prompt") patch.usedSlashOrPrompt = true;
    if (body.key === "opened_share") patch.openedShare = true;
    if (body.key === "dismissed") patch.dismissed = true;

    await db.update(userChecklist).set(patch).where(eq(userChecklist.userId, user.id));

    if (body.key === "dismissed") {
      await db
        .update(users)
        .set({ onboardingCompletedAt: now() })
        .where(eq(users.id, user.id));
    }

    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
