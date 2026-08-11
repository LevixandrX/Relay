import { NextResponse } from "next/server";
import { ApiError, handleRouteError } from "@/lib/errors";
import { setSessionCookie } from "@/lib/session";
import {
  exchangeOAuthCode,
  finishRedirect,
  upsertOAuthUser,
  verifyOAuthState,
  appUrl,
  type OAuthProvider,
} from "@/domain/auth/oauth";
import { completePairing, failPairing } from "@/domain/auth/pairing";

function errorRedirect(message: string) {
  return NextResponse.redirect(`${appUrl()}/login?error=${encodeURIComponent(message)}`);
}

export async function handleOAuthCallback(provider: OAuthProvider, req: Request) {
  let pair: string | undefined;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    const parsed = state ? await verifyOAuthState(state) : null;
    pair = parsed?.pair;

    if (err) {
      if (pair) await failPairing(pair, err);
      return errorRedirect(err);
    }
    if (!code || !state) {
      throw new ApiError(400, "validation_error", "Missing code/state");
    }
    if (!parsed || parsed.provider !== provider) {
      throw new ApiError(400, "invalid_state", "Invalid OAuth state");
    }

    const profile = await exchangeOAuthCode(provider, code);
    const userId = await upsertOAuthUser({
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
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    if (pair) await failPairing(pair, message).catch(() => {});
    if (/EMAIL_REQUIRED|TOKEN_FAILED|PROFILE_FAILED|EMAIL_CONFLICT/.test(message)) {
      return errorRedirect(message);
    }
    return handleRouteError(err);
  }
}
