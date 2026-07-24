import { z } from "zod";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { setSessionCookie } from "@/lib/session";
import { registerUser } from "@/domain/auth/register";

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`auth:register:${req.headers.get("x-forwarded-for") ?? "local"}`, 5);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Слишком много попыток — подожди минуту");

    const body = z
      .object({
        email: z.string().email("Укажи корректный email"),
        password: z.string().min(8, "Пароль — минимум 8 символов").max(200),
        name: z.string().min(1, "Укажи имя").max(80),
        intent: z.enum(["write", "plan", "team"]).optional(),
      })
      .parse(await req.json());

    try {
      const result = await registerUser(body);
      const accessToken = await setSessionCookie(result.userId);
      return json({ ...result, accessToken }, 201);
    } catch (e) {
      if (e instanceof Error && e.message === "EMAIL_TAKEN") {
        throw new ApiError(409, "email_taken", "Этот email уже зарегистрирован");
      }
      throw e;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
