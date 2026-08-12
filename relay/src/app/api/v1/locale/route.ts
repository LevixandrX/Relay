import { NextResponse } from "next/server";
import { isAppLocale, localeCookieName } from "@/i18n/config";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { locale?: string } | null;
  const locale = body?.locale;
  if (!isAppLocale(locale)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
