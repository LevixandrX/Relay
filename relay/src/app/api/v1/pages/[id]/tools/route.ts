import {movePageBlock} from '@/domain/blocks/move';
import {z} from 'zod';
import { requireSession } from '@/lib/session';
import { ApiError, handleRouteError, json } from '@/lib/errors';
import { listResourcePages, readPageAsset, uploadPageAsset } from '@/domain/blocks/resources';
import { MAX_ASSET_BYTES } from '@/domain/blocks/rich-content';
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) {
  try {
    const user = await requireSession(), { id } = await context.params, assetId = new URL(req.url).searchParams.get('assetId');
    return json(assetId ? await readPageAsset(user.id, id, assetId) : await listResourcePages(user.id, id));
  } catch (error) { return handleRouteError(error); }
}
export async function POST(req: Request, context: Context) {
  try {
    const user = await requireSession(), { id } = await context.params;
    const limit = Math.ceil(MAX_ASSET_BYTES / 3) * 4 + 2048;
    if (Number(req.headers.get('content-length') ?? 0) > limit) throw new ApiError(413, 'too_large', 'File is too large');
    const reader = req.body?.getReader(), chunks: Uint8Array[] = []; let length = 0;
    if (reader) for (;;) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) { await reader.cancel(); throw new ApiError(413, 'too_large', 'File is too large'); }
      chunks.push(part.value);
    }
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(input?.action==='moveBlock'){const move=z.object({targetPageId:z.string().min(1).max(100),blockId:z.string().max(100),content:z.unknown()}).parse(input);return json(await movePageBlock(user.id,id,move));}
    return json(await uploadPageAsset(user.id,id,input),201);
  } catch (error) { if (error instanceof SyntaxError) return json({error:'validation_error',message:'Invalid JSON'},400); return handleRouteError(error); }
}
