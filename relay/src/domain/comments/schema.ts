import { EMOJI_VALUES } from "@/lib/emoji";
import { z } from "zod";
const key = z.string().min(1).max(120);
const file = z.object({ name: z.string().min(1).max(255), type: z.string().max(150), size: z.number().int().min(0).max(2 * 1024 * 1024), data: z.string().max(2796204).regex(/^[A-Za-z0-9+/]*={0,2}$/) });
const draft = { body: z.string().max(10000), mentions: z.array(key).max(30), pages: z.array(key).max(30), files: z.array(file).max(3), dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s)).max(30).optional() };
export const commentCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createEmoji"), name: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{N}_-]+$/u), type: z.literal("image/png"), data: z.string().max(43692).regex(/^[A-Za-z0-9+/]*={0,2}$/) }),
  z.object({ action: z.literal("create"), blockId: z.string().regex(/^blk_[a-zA-Z0-9-]{8,80}$/), quote: z.string().max(4000), anchorOffset: z.number().int().min(0).max(500000).nullable(), ...draft }),
  z.object({ action: z.literal("reply"), threadId: key, ...draft }),
  z.object({ action: z.literal("edit"), threadId: key, messageId: key, body: z.string().trim().min(1).max(10000) }),
  z.object({ action: z.literal("deleteMessage"), threadId: key, messageId: key }),
  z.object({ action: z.enum(["resolve", "unread", "mute"]), threadId: key, value: z.boolean() }),
  z.object({ action: z.literal("react"), threadId: key, messageId: key, emoji: z.string().max(80).refine((s) => EMOJI_VALUES.has(s) || /^custom:[a-f0-9-]{36}$/.test(s)) }),
]);
