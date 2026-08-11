import { NextResponse } from "next/server";
import { ApiError, handleRouteError } from "@/lib/errors";
import {
  authorizeUrl,
  providerEnvPrefix,
  signOAuthState,
  type OAuthClient,
  type OAuthProvider,
} from "@/domain/auth/oauth";
import { id } from "@/lib/ids";

function parseClient(url: URL): OAuthClient {
  const c = url.searchParams.get("client");
  return c === "desktop" ? "desktop" : "web";
}

export function providerNotConfigured(provider: OAuthProvider) {
  const key = providerEnvPrefix(provider);
  return new ApiError(
    503,
    "oauth_not_configured",
    `${provider} OAuth не настроен: добавь ${key}_CLIENT_ID и ${key}_CLIENT_SECRET в relay/.env.local и перезапусти сервер`,
  );
}

export async function buildAuthorizeUrl(input: {
  provider: OAuthProvider;
  client: OAuthClient;
  pair?: string;
}) {
  const state = await signOAuthState({
    provider: input.provider,
    client: input.client,
    nonce: id.token(),
    pair: input.pair,
  });
  return authorizeUrl(input.provider, state);
}

export async function startOAuth(provider: OAuthProvider, req: Request) {
  try {
    const url = new URL(req.url);
    const client = parseClient(url);
    // Pairing codes are only valid for the desktop handshake — ignore on web.
    const pair = client === "desktop" ? (url.searchParams.get("pair") ?? undefined) : undefined;
    const dest = await buildAuthorizeUrl({ provider, client, pair });
    return NextResponse.redirect(dest);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not set")) {
      return handleRouteError(providerNotConfigured(provider));
    }
    return handleRouteError(err);
  }
}
