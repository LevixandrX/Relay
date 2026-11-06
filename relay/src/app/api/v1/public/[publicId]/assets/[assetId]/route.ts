import { publicAsset } from '@/domain/blocks/resources';
import { handleRouteError } from '@/lib/errors';
export async function GET(_req: Request, context: { params: Promise<{ publicId: string; assetId: string }> }) {
  try {
    const { publicId, assetId } = await context.params, file = await publicAsset(publicId, assetId);
    const inline = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm|ogg)|audio\/(mpeg|mp4|ogg|wav|webm)|application\/pdf)$/.test(file.type);
    return new Response(Buffer.from(file.data,'base64'), { headers: {
      'Content-Type': inline ? file.type : 'application/octet-stream', 'Content-Length': String(file.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store', 'Content-Security-Policy':"sandbox; default-src 'none'",
    } });
  } catch (error) { return handleRouteError(error); }
}
