import { EMOJI_VALUES, type CustomEmoji } from "../lib/emoji";
import type { BlockActivityInfo } from "../lib/block-activity";
import type { CommentCommand, CommentData, CommentFile, CommentPage, CommentPerson, CommentThread, FileUpload } from "./comment-types";
/** Desktop guest data only. Cloud comments always go through the authenticated API. */
export async function guestCommentRequest<T>(pageId: string, pages: CommentPage[], me: CommentPerson, suffix: string, init?: RequestInit): Promise<T> {
  const key = `relay-guest-comments-v1:${pageId}`;
  const raw = localStorage.getItem(key);
  const stored = raw ? JSON.parse(raw) as { threads: CommentThread[]; files: Record<string, FileUpload> } : { threads: [], files: {} as Record<string, FileUpload> };
  const emojiKey = "relay-guest-emojis-v1";
  const emojiList = (): CustomEmoji[] => JSON.parse(localStorage.getItem(emojiKey) ?? "[]");
  const data = (): CommentData => ({ customEmojis: emojiList(), threads: stored.threads, people: [me], pages, me });
  const query = new URLSearchParams(suffix.replace(/^\?/, ""));
  const blockId = query.get("blockActivity");
  if (blockId) return (JSON.parse(localStorage.getItem(`relay-guest-block-activity-v1:${pageId}`) ?? "{}") as Record<string, BlockActivityInfo>)[blockId] as T ?? null as T;
  const preview = query.get("previewPage");
  if (preview) { const page = pages.find((p) => p.id === preview); if (!page) throw new Error("Page not found"); type TextNode = { text?: string; content?: TextNode[] };
    const texts: string[] = []; const walk = (node: TextNode) => { if (node.text) texts.push(node.text); node.content?.forEach(walk); };
    const content = (page as typeof page & { content?: TextNode }).content; if (content) walk(content);
    return { title: page.title, icon: page.icon ?? null, excerpt: texts.join(" ").slice(0, 450) } as T; }
  const fileId = query.get("fileId");
  if (fileId) { if (!stored.files[fileId]) throw new Error("File not found"); return stored.files[fileId] as T; }
  if (init?.method !== "POST") return data() as T;
  const command = JSON.parse(String(init.body)) as CommentCommand;
  const ts = new Date().toISOString();
  if (command.action === "createEmoji") {
    const current = emojiList(); const name = command.name.trim().toLocaleLowerCase();
    if (current.length >= 64 || current.some((e) => e.name === name) || !/^[\p{L}\p{N}_-]{1,40}$/u.test(name) || command.type !== "image/png" || command.data.length > 43692 || !command.data.startsWith("iVBORw0KGgo")) throw new Error("Invalid custom emoji");
    current.push({ id: crypto.randomUUID(), name, data: command.data, type: command.type }); localStorage.setItem(emojiKey, JSON.stringify(current)); return data() as T;
  }
  if (command.action === "react" && !EMOJI_VALUES.has(command.emoji) && !emojiList().some((e) => `custom:${e.id}` === command.emoji)) throw new Error("Unknown emoji");
  const thread = command.action === "create" ? null : stored.threads.find((t) => t.id === command.threadId);
  if (command.action !== "create" && !thread) throw new Error("Thread not found");
  if (command.action === "create" || command.action === "reply") {
    if (stored.threads.length >= 200 && command.action === "create") throw new Error("Comment limit");
    const target = thread ?? { id: crypto.randomUUID(), blockId: command.action === "create" ? command.blockId : "", quote: command.action === "create" ? command.quote : "", anchorOffset: command.action === "create" ? command.anchorOffset : null, resolved: false, updatedAt: ts, unread: false, muted: false, messages: [] };
    if (target.messages.length >= 100) throw new Error("Reply limit");
    const files: CommentFile[] = command.files.map((file) => { const id = crypto.randomUUID(); stored.files[id] = file; return { id, name: file.name, size: file.size, type: file.type }; });
    target.messages.push({ id: crypto.randomUUID(), author: me, body: command.body.trim(), dates: command.dates ?? [], createdAt: ts, editedAt: null, mentions: command.mentions.includes(me.id) ? [me] : [], pages: pages.filter((p) => command.pages.includes(p.id)).map(({ id, title, icon }) => ({ id, title, icon })), files, reactions: [] });
    target.updatedAt = ts; target.unread = false; target.resolved = false;
    if (!thread) stored.threads.push(target);
  } else if (command.action === "resolve") { thread!.resolved = command.value; thread!.updatedAt = ts; }
  else if (command.action === "unread") thread!.unread = command.value;
  else if (command.action === "mute") thread!.muted = command.value;
  else {
    const message = thread!.messages.find((m) => m.id === command.messageId);
    if (!message) throw new Error("Comment not found");
    if (command.action === "edit") { message.body = command.body; message.editedAt = ts; thread!.updatedAt = ts; }
    else if (command.action === "deleteMessage") {
      message.files.forEach((f) => delete stored.files[f.id]);
      thread!.messages = thread!.messages.filter((m) => m.id !== message.id);
      if (!thread!.messages.length) stored.threads = stored.threads.filter((t) => t.id !== thread!.id);
    } else if (command.action === "react") {
      let reaction = message.reactions.find((r) => r.emoji === command.emoji);
      if (!reaction) { reaction = { emoji: command.emoji, userIds: [] }; message.reactions.push(reaction); }
      reaction.userIds = reaction.userIds.includes(me.id) ? reaction.userIds.filter((v) => v !== me.id) : [...reaction.userIds, me.id];
      message.reactions = message.reactions.filter((r) => r.userIds.length);
    }
  }
  localStorage.setItem(key, JSON.stringify(stored)); // Quota errors keep the UI draft intact.
  return data() as T;
}
