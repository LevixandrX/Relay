/**
 * Prefer the platform-resolved IP. Only trust X-Forwarded-For when explicitly
 * running behind a reverse proxy (TRUST_PROXY=1).
 */
export function clientKey(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const xf = req.headers.get("x-forwarded-for");
    if (xf) return xf.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}
