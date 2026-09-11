/** Public web origin — prefer localhost over 127.0.0.1 (cookie/host mismatch). */
export function publicAppOrigin() {
  const raw =
    (import.meta.env.VITE_APP_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "").replace(/^http:\/\/127\.0\.0\.1(?=[:/]|$)/, "http://localhost");
}
