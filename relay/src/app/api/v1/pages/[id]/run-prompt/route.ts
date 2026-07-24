import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pages, type Role } from "@/db/schema";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { getPageForUser, serializePage } from "@/domain/pages/repo";
import { parseDoc, docToPlainText } from "@/domain/blocks/schema";
import { insertAfterPrompt, runPrompt } from "@/domain/prompts/runner";
import { now } from "@/lib/ids";
import { writeAudit } from "@/domain/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { id } = await ctx.params;
    const found = await getPageForUser(user.id, id);
    if (!found) throw new ApiError(404, "not_found", "Not found");
    if (found.role === "viewer") {
      throw new ApiError(403, "forbidden", "Insufficient permissions");
    }

    const rl = rateLimit(`prompt:${found.page.workspaceId}`, 20);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Prompt limit reached");

    const body = z
      .object({
        prompt: z.string().min(1).max(2000),
      })
      .parse(await req.json());

    const doc = parseDoc(JSON.parse(found.page.content));
    const generated = await runPrompt(doc, body.prompt);
    const next = insertAfterPrompt(doc, body.prompt, generated);
    const ts = now();
    await db
      .update(pages)
      .set({
        content: JSON.stringify(next),
        plainText: docToPlainText(next),
        updatedAt: ts,
      })
      .where(eq(pages.id, id));

    await writeAudit({
      workspaceId: found.page.workspaceId,
      actorId: user.id,
      action: "page.prompt",
      targetType: "page",
      targetId: id,
      meta: { prompt: body.prompt.slice(0, 120) },
    });

    const updated = { ...found.page, content: JSON.stringify(next), updatedAt: ts };
    return json(serializePage(updated, found.role as Role));
  } catch (err) {
    return handleRouteError(err);
  }
}
