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

export async function handleOAuthCallback(provider: OAuthProvider, req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    if (err) {
      return NextResponse.redirect(
        `${appUrl()}/login?error=${encodeURIComponent(err)}`,
      );
    }
    if (!code || !state) {
      throw new ApiError(400, "validation_error", "Missing code/state");
    }
    const parsed = await verifyOAuthState(state);
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
    const dest = finishRedirect({ client: parsed.client, accessToken });
    return NextResponse.redirect(dest);
  } catch (err) {
    if (err instanceof Error && /EMAIL_REQUIRED|TOKEN_FAILED|PROFILE_FAILED/.test(err.message)) {
      return NextResponse.redirect(
        `${appUrl()}/login?error=${encodeURIComponent(err.message)}`,
      );
    }
    return handleRouteError(err);
  }
}
