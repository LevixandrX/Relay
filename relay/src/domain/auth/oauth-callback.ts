import { NextResponse } from "next/server";
import { ApiError, handleRouteError } from "@/lib/errors";
import { setSessionCookie } from "@/lib/session";
import {
  exchangeOAuthCode,
  finishRedirect,
  linkOAuthToUser,
  upsertOAuthUser,
  verifyOAuthState,
  appUrl,
  sanitizeNextPath,
  type OAuthProvider,
} from "@/domain/auth/oauth";
import { completePairing, failPairing } from "@/domain/auth/pairing";

function errorRedirect(message: string, next?: string) {
  const path = next && sanitizeNextPath(next) !== "/app" ? sanitizeNextPath(next) : "/login";
  const u = new URL(`${appUrl()}${path}`);
  u.searchParams.set("error", message);
  return NextResponse.redirect(u.toString());
}

export async function handleOAuthCallback(provider: OAuthProvider, req: Request) {
  let pair: string | undefined;
  let next: string | undefined;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    const parsed = state ? await verifyOAuthState(state) : null;
    pair = parsed?.pair;
    next = parsed?.next;

    if (err) {
      if (pair) await failPairing(pair, err);
      return errorRedirect(err, next);
    }
    if (!code || !state) {
      throw new ApiError(400, "validation_error", "Missing code/state");
    }
    if (!parsed || parsed.provider !== provider) {
      throw new ApiError(400, "invalid_state", "Invalid OAuth state");
    }

    const profile = await exchangeOAuthCode(provider, code);
    const userId = parsed.linkUserId
      ? await linkOAuthToUser(parsed.linkUserId, {
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
        })
      : await upsertOAuthUser({
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        });
    const accessToken = await setSessionCookie(userId);

    const paired = pair ? await completePairing({ code: pair, provider, accessToken }) : false;
    return NextResponse.redirect(
      finishRedirect({
        client: parsed.client,
        provider,
        pairRequested: !!pair,
        paired,
        next,
      }),
    );
  } catch (err) {
    const code = err instanceof ApiError ? err.code : err instanceof Error ? err.message : "oauth_failed";
    if (pair) await failPairing(pair, code).catch(() => {});
    if (
      err instanceof ApiError ||
      /EMAIL_REQUIRED|TOKEN_FAILED|PROFILE_FAILED|EMAIL_CONFLICT/.test(code)
    ) {
      return errorRedirect(code, next);
    }
    return handleRouteError(err);
  }
}
