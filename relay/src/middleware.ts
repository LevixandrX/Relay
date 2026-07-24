import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders, corsOrigins } from "@/lib/cors";

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  // Ensure we never echo a disallowed origin as credentialed *
  if (origin && !corsOrigins().includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", corsOrigins()[0] ?? "http://127.0.0.1:1420");
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
