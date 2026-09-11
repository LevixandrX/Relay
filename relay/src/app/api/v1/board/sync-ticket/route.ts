import { z } from "zod";
import { createBoardSyncTicket } from "@/domain/board/sync-ticket";
import { handleRouteError, json } from "@/lib/errors";
import { requireSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    const body = z
      .object({
        room: z.string().min(3).max(128),
        write: z.boolean().optional(),
      })
      .parse(await req.json());

    const token = await createBoardSyncTicket({
      userId: user.id,
      userName: user.name,
      room: body.room,
      write: body.write ?? true,
    });

    return json({ token, expiresIn: 120 });
  } catch (err) {
    return handleRouteError(err);
  }
}
