const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:3000";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      (data as { error?: string }).error || "error",
      (data as { message?: string }).message || "Ошибка API",
      (data as { details?: unknown }).details,
    );
  }
  return data as T;
}

export type OAuthProvider = "google" | "github" | "yandex" | "vk";

export type PairingStatus =
  | { status: "pending" }
  | { status: "ready"; accessToken: string }
  | { status: "error"; message: string }
  | { status: "expired" };

/** Ask the server for a handshake code + provider URL to open in the system browser. */
export function startPairing(
  provider: OAuthProvider,
  opts?: { intent?: "link"; token?: string | null },
) {
  return api<{ code: string; claimSecret: string; url: string; expiresInSec: number }>(
    "/auth/desktop/pair",
    {
      method: "POST",
      token: opts?.token,
      body: JSON.stringify({ provider, intent: opts?.intent }),
    },
  );
}

export function claimPairing(code: string, claimSecret: string) {
  return api<PairingStatus>("/auth/desktop/claim", {
    method: "POST",
    body: JSON.stringify({ code, claimSecret }),
  });
}

export { API_URL };
