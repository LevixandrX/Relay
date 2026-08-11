import { z } from "zod";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { setSessionCookie } from "@/lib/session";
import { verifyLogin } from "@/domain/auth/register";
import { clientKey } from "@/lib/client-ip";

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`auth:login:${clientKey(req)}`, 10);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Слишком много попыток — подожди минуту");

    const body = z
      .object({
        email: z.string().email("Укажи корректный email"),
        password: z.string().min(1, "Введи пароль").max(200),
      })
      .parse(await req.json());

    const user = await verifyLogin(body.email, body.password);
    if (!user) throw new ApiError(401, "invalid_credentials", "Неверный email или пароль");

    const accessToken = await setSessionCookie(user.id);
    return json({
      userId: user.id,
      name: user.name,
      email: user.email,
      accessToken,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
