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

export function corsHeaders(origin: string | null): HeadersInit {
  const allowed = corsOrigins();
  const ok = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": ok ?? "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function withCors(res: Response, origin: string | null) {
  const headers = corsHeaders(origin);
  const next = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) {
    next.headers.set(k, v);
  }
  return next;
}
