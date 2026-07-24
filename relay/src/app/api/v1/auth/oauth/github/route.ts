import { startOAuth } from "@/domain/auth/oauth-start";

export async function GET(req: Request) {
  return startOAuth("github", req);
}
