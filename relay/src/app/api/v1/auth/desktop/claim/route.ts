import { z } from "zod";
import { handleRouteError, json, ApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { claimPairing } from "@/domain/auth/pairing";
import { clientKey } from "@/lib/client-ip";

const schema = z.object({
  code: z.string().min(10).max(80),
  claimSecret: z.string().min(16).max(128),
});

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`auth:claim:${clientKey(req)}`, 120);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Слишком много попыток — подожди минуту");

    const { code, claimSecret } = schema.parse(await req.json());
    return json(await claimPairing(code, claimSecret));
  } catch (err) {
    return handleRouteError(err);
  }
}
