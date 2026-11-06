import { z } from 'zod';
import { MAX_ASSET_BYTES } from './rich-content';
export const assetUpload = z.object({
  action: z.literal('upload'), name: z.string().trim().min(1).max(255),
  type: z.string().max(120).regex(/^[\w.+-]+\/[\w.+-]+$/),
  size: z.number().int().positive().max(MAX_ASSET_BYTES),
  data: z.string().max(Math.ceil(MAX_ASSET_BYTES / 3) * 4).regex(/^[A-Za-z0-9+/]*={0,2}$/),
});
