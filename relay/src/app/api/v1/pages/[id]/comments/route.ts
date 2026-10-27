import { readBlockActivity } from "@/domain/blocks/activity";
import { requireSession } from "@/lib/session";
import { ApiError, handleRouteError, json } from "@/lib/errors";
import { applyComment, listComments, readCommentFile, previewCommentPage } from "@/domain/comments/repo";
import { commentCommand } from "@/domain/comments/schema";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const user = await requireSession(), { id } = await ctx.params;
    const query = new URL(req.url).searchParams;
    const blockId = query.get("blockActivity");
    if (blockId) {
      if (!/^blk_[a-zA-Z0-9-]{8,80}$/.test(blockId)) throw new ApiError(400, "validation_error", "Invalid block ID");
      return json(await readBlockActivity(user.id, id, blockId));
    }
    const previewPage = query.get("previewPage");
    if (previewPage) return json(await previewCommentPage(user.id, id, previewPage));
    const fileId = query.get("fileId");
    return json(fileId ? await readCommentFile(user.id, id, fileId) : await listComments(user.id, id));
  } catch (error) { return handleRouteError(error); }
}
export async function POST(req: Request, ctx: Context) {
  try {
    const user = await requireSession(), { id } = await ctx.params;
    if (Number(req.headers.get("content-length") ?? 0) > 9 * 1024 * 1024) throw new ApiError(413, "too_large", "Attachments are too large");
    // Also bound chunked requests, which may not carry Content-Length.
    const reader = req.body?.getReader();
    let length = 0; const chunks: Uint8Array[] = [];
    if (reader) for (;;) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > 9 * 1024 * 1024) { await reader.cancel(); throw new ApiError(413, "too_large", "Attachments are too large"); }
      chunks.push(part.value);
    }
    const command = commentCommand.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return json(await applyComment(user.id, id, command));
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "validation_error", message: "Invalid JSON" }, 400);
    return handleRouteError(error);
  }
}
