const DEFAULT_ORIGINS = [
  "http://127.0.0.1:1420",
  "http://localhost:1420",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "tauri://localhost",
  "https://tauri.localhost",
];

export function corsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ORIGINS;
}

/** Only echo ACAO for an allowlisted Origin — never fall back to a "default" origin. */
export function corsHeaders(origin: string | null): HeadersInit {
  const allowed = corsOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export function withCors(res: Response, origin: string | null) {
  const headers = corsHeaders(origin);
  const next = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) {
    next.headers.set(k, v);
  }
  return next;
}
