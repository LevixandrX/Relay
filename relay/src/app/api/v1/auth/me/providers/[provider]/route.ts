import { z } from "zod";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { OAUTH_PROVIDERS, unlinkOAuthProvider } from "@/domain/auth/oauth";

type Ctx = { params: Promise<{ provider: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { provider } = await ctx.params;
    const parsed = z.enum(OAUTH_PROVIDERS).parse(provider);
    await unlinkOAuthProvider(user.id, parsed);
    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
