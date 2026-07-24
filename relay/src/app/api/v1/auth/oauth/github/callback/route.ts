import { handleOAuthCallback } from "@/domain/auth/oauth-callback";

export async function GET(req: Request) {
  return handleOAuthCallback("github", req);
}
