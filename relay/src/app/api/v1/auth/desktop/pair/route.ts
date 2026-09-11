import { z } from "zod";
import { handleRouteError, json, ApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { buildAuthorizeUrl, providerNotConfigured } from "@/domain/auth/oauth-start";
import { createPairing } from "@/domain/auth/pairing";
import { OAUTH_PROVIDERS, isOAuthProvider } from "@/domain/auth/oauth";
import { clientKey } from "@/lib/client-ip";
import { requireSession } from "@/lib/session";

const schema = z.object({
  provider: z.enum(OAUTH_PROVIDERS),
  intent: z.enum(["login", "link"]).optional(),
});

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`auth:pair:${clientKey(req)}`, 20);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Слишком много попыток — подожди минуту");

    const { provider, intent } = schema.parse(await req.json());
    let linkUserId: string | undefined;
    if (intent === "link") {
      const user = await requireSession();
      linkUserId = user.id;
    }
    const { code, claimSecret } = await createPairing(provider);
    const url = await buildAuthorizeUrl({
      provider,
      client: "desktop",
      pair: code,
      linkUserId,
    });
    return json({ code, claimSecret, url, expiresInSec: 600 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not set")) {
      const match = err.message.match(/^(GOOGLE|GITHUB|YANDEX|VK)_/);
      const provider = match ? match[1].toLowerCase() : "google";
      return handleRouteError(
        providerNotConfigured(isOAuthProvider(provider) ? provider : "google"),
      );
    }
    return handleRouteError(err);
  }
}
