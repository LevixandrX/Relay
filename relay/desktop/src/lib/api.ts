const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:3000";

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

export function oauthUrl(provider: "google" | "github") {
  return `${API_URL}/api/v1/auth/oauth/${provider}?client=desktop`;
}

export { API_URL };
