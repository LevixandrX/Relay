import { clearSessionCookie } from "@/lib/session";
import { json } from "@/lib/errors";

export async function POST() {
  await clearSessionCookie();
  return json({ ok: true });
}
