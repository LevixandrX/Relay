import { cookies, headers } from "next/headers";
import { clearSessionCookie, revokeSessionToken, SESSION_COOKIE } from "@/lib/session";
import { json } from "@/lib/errors";

export async function POST() {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    await revokeSessionToken(auth.slice(7).trim());
  }

  const jar = await cookies();
  const cookieToken = jar.get(SESSION_COOKIE)?.value;
  if (cookieToken) {
    await revokeSessionToken(cookieToken);
    jar.delete(SESSION_COOKIE);
  } else {
    await clearSessionCookie();
  }

  return json({ ok: true });
}
