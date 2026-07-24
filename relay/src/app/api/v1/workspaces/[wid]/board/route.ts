import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { getWorkspaceBoard, saveWorkspaceBoard } from "@/domain/board/repo";
import { z } from "zod";

type Ctx = { params: Promise<{ wid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    const data = await getWorkspaceBoard(user.id, wid);
    return json(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const user = await requireSession();
    const { wid } = await ctx.params;
    const body = z.object({ board: z.unknown() }).parse(await req.json());
    const result = await saveWorkspaceBoard(user.id, wid, body.board);
    return json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
