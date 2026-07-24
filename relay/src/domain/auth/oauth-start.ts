import { NextResponse } from "next/server";
import { ApiError, handleRouteError } from "@/lib/errors";
import {
  githubAuthUrl,
  googleAuthUrl,
  signOAuthState,
  type OAuthClient,
  type OAuthProvider,
} from "@/domain/auth/oauth";
import { id } from "@/lib/ids";

function parseClient(url: URL): OAuthClient {
  const c = url.searchParams.get("client");
  return c === "desktop" ? "desktop" : "web";
}

export async function startOAuth(provider: OAuthProvider, req: Request) {
  try {
    const url = new URL(req.url);
    const client = parseClient(url);
    const state = await signOAuthState({
      provider,
      client,
      nonce: id.token(),
    });
    const dest =
      provider === "google" ? googleAuthUrl(state) : githubAuthUrl(state);
    return NextResponse.redirect(dest);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not set")) {
      return handleRouteError(
        new ApiError(
          503,
          "oauth_not_configured",
          `${provider} OAuth не настроен. Добавь CLIENT_ID/SECRET в .env`,
        ),
      );
    }
    return handleRouteError(err);
  }
}
