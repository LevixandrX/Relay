import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { commentThreads, comments, commentFiles, commentReactions, commentStates, memberships, users, pages, customEmojis } from "@/db/schema";
import { getPageForUser } from "@/domain/pages/repo";
import { ApiError } from "@/lib/errors";
import type { CommentCommand, CommentData, CommentPerson } from "@/editor/comment-types";
const missing = () => new ApiError(404, "not_found", "Not found");
async function access(userId: string, pageId: string, write = false) {
  const found = await getPageForUser(userId, pageId);
  if (!found) throw missing();
  if (write && found.role === "viewer") throw new ApiError(403, "forbidden", "Insufficient permissions");
  return found;
}
export async function listComments(userId: string, pageId: string): Promise<CommentData> {
  const { page } = await access(userId, pageId);
  const members = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.workspaceId, page.workspaceId));
  const people: CommentPerson[] = members.map((p) => ({ ...p, role: p.role === "owner" || p.role === "editor" || p.role === "viewer" ? p.role : undefined }));
  const linkedPages = await db.select({ id: pages.id, title: pages.title, icon: pages.icon }).from(pages).where(and(eq(pages.workspaceId, page.workspaceId), isNull(pages.deletedAt)));
  const emojis = await db.select({ id: customEmojis.id, name: customEmojis.name, data: customEmojis.data, type: customEmojis.type }).from(customEmojis).where(eq(customEmojis.workspaceId, page.workspaceId)).limit(64);
  const custom = emojis.map((e) => ({ ...e, type: "image/png" as const }));
  const threads = await db.select().from(commentThreads).where(eq(commentThreads.pageId, pageId)).orderBy(asc(commentThreads.createdAt)).limit(200);
  if (!threads.length) return { customEmojis: custom, threads: [], people, pages: linkedPages, me: people.find((p) => p.id === userId)! };
  const ids = threads.map((t) => t.id);
  const rows = await db.select({ comment: comments, author: { id: users.id, name: users.name, avatarUrl: users.avatarUrl } }).from(comments).innerJoin(users, eq(users.id, comments.authorId)).where(inArray(comments.threadId, ids)).orderBy(asc(comments.createdAt));
  const messageIds = rows.map((r) => r.comment.id);
  const files = messageIds.length ? await db.select({ id: commentFiles.id, commentId: commentFiles.commentId, name: commentFiles.name, size: commentFiles.size, type: commentFiles.type }).from(commentFiles).where(inArray(commentFiles.commentId, messageIds)) : [];
  const reactions = messageIds.length ? await db.select().from(commentReactions).where(inArray(commentReactions.commentId, messageIds)) : [];
  const states = await db.select().from(commentStates).where(and(inArray(commentStates.threadId, ids), eq(commentStates.userId, userId)));
  return { customEmojis: custom, people, pages: linkedPages, me: people.find((p) => p.id === userId)!, threads: threads.map((thread) => {
    const state = states.find((s) => s.threadId === thread.id);
    return { id: thread.id, blockId: thread.blockId, quote: thread.quote, anchorOffset: thread.anchorOffset, resolved: thread.resolved, updatedAt: thread.updatedAt, muted: state?.muted ?? false, unread: !state?.readAt || state.readAt < thread.updatedAt, messages: rows.filter((r) => r.comment.threadId === thread.id).map(({ comment, author }) => {
      const grouped = new Map<string, string[]>();
      reactions.filter((r) => r.commentId === comment.id).forEach((r) => grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.userId]));
      return { id: comment.id, author: { ...author, role: people.find((p) => p.id === author.id)?.role }, body: comment.body, createdAt: comment.createdAt, editedAt: comment.editedAt, dates: JSON.parse(comment.dates), mentions: JSON.parse(comment.mentions), pages: JSON.parse(comment.pageLinks), files: files.filter((f) => f.commentId === comment.id).map(({ commentId: _, ...file }) => file), reactions: [...grouped].map(([emoji, userIds]) => ({ emoji, userIds })) };
    }) };
  }) };
}
export async function readCommentFile(userId: string, pageId: string, fileId: string) {
  await access(userId, pageId);
  const rows = await db.select({ file: commentFiles }).from(commentFiles).innerJoin(comments, eq(comments.id, commentFiles.commentId)).innerJoin(commentThreads, eq(commentThreads.id, comments.threadId)).where(and(eq(commentThreads.pageId, pageId), eq(commentFiles.id, fileId))).limit(1);
  if (!rows[0]) throw missing();
  const { commentId: _, ...file } = rows[0].file;
  return file;
}
export async function applyComment(userId: string, pageId: string, command: CommentCommand) {
  const write = !["unread", "mute"].includes(command.action);
  const { page, role } = await access(userId, pageId, write);
  const ts = new Date().toISOString();
  if (command.action === "createEmoji") {
    const bytes = Buffer.from(command.data, "base64");
    if (bytes.length > 32768 || bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(16) > 64 || bytes.readUInt32BE(20) > 64 || !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20)) throw new ApiError(400, "validation_error", "Emoji must be a PNG of up to 64 × 64 pixels and 32 KB");
    const name = command.name.trim().toLocaleLowerCase();
    await db.transaction(async (tx) => {
      const existing = await tx.select({ id: customEmojis.id }).from(customEmojis).where(eq(customEmojis.workspaceId, page.workspaceId));
      if (existing.length >= 64) throw new ApiError(400, "limit", "Workspace emoji limit reached");
      if ((await tx.select().from(customEmojis).where(and(eq(customEmojis.workspaceId, page.workspaceId), eq(customEmojis.name, name))).limit(1)).length) throw new ApiError(400, "validation_error", "Emoji name is already used");
      await tx.insert(customEmojis).values({ id: randomUUID(), workspaceId: page.workspaceId, name, data: command.data, type: command.type, createdBy: userId, createdAt: ts });
    });
    return listComments(userId, pageId);
  }
  if (command.action === "react" && command.emoji.startsWith("custom:")) {
    const found = await db.select().from(customEmojis).where(and(eq(customEmojis.id, command.emoji.slice(7)), eq(customEmojis.workspaceId, page.workspaceId))).limit(1);
    if (!found.length) throw missing();
  }
  // Every lookup is scoped to the authorized page before an ID is used for a mutation.
  const thread = command.action !== "create" ? (await db.select().from(commentThreads).where(and(eq(commentThreads.id, command.threadId), eq(commentThreads.pageId, pageId))).limit(1))[0] : null;
  if (command.action !== "create" && !thread) throw missing();
  const messageId = "messageId" in command ? command.messageId : null;
  const message = messageId ? (await db.select().from(comments).where(and(eq(comments.id, messageId), eq(comments.threadId, thread!.id))).limit(1))[0] : null;
  if (messageId && !message) throw missing();
  if (command.action === "edit" || command.action === "deleteMessage") {
    if (message!.authorId !== userId && !(command.action === "deleteMessage" && role === "owner")) throw new ApiError(403, "forbidden", "Only the author may edit this comment");
  }
  let mentions: CommentPerson[] = [], pageLinks: { id: string; title: string; icon: string | null }[] = [];
  if (command.action === "create" || command.action === "reply") {
    if (!command.body.trim() && !command.files.length && !command.pages.length) throw new ApiError(400, "validation_error", "Comment is empty");
    const data = await listComments(userId, pageId);
    if (command.action === "create" && data.threads.length >= 200) throw new ApiError(400, "limit", "Page comment limit reached");
    if (thread && data.threads.find((t) => t.id === thread.id)!.messages.length >= 100) throw new ApiError(400, "limit", "Thread reply limit reached");
    mentions = data.people.filter((p) => command.mentions.includes(p.id));
    pageLinks = data.pages.filter((p) => command.pages.includes(p.id)).map((p) => ({ ...p, icon: p.icon ?? null }));
    if (new Set(command.mentions).size !== mentions.length || new Set(command.pages).size !== pageLinks.length) throw new ApiError(400, "validation_error", "Mention or page is outside this workspace");
    for (const file of command.files) {
      if (Buffer.from(file.data, "base64").length !== file.size) throw new ApiError(400, "validation_error", "Invalid file size");
    }
  }
  await db.transaction(async (tx) => {
    if (command.action === "create" || command.action === "reply") {
      const size = await tx.select({ total: sql<number>`coalesce(sum(${commentFiles.size}), 0)` }).from(commentFiles).innerJoin(comments, eq(comments.id, commentFiles.commentId)).innerJoin(commentThreads, eq(commentThreads.id, comments.threadId)).where(eq(commentThreads.pageId, pageId));
      if (Number(size[0]?.total ?? 0) + command.files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) throw new ApiError(400, "limit", "Page attachment limit reached");
      const threadId = thread?.id ?? randomUUID();
      if (command.action === "create") await tx.insert(commentThreads).values({ id: threadId, pageId, blockId: command.blockId, quote: command.quote, anchorOffset: command.anchorOffset, createdBy: userId, createdAt: ts, updatedAt: ts });
      const commentId = randomUUID();
      await tx.insert(comments).values({ id: commentId, threadId, authorId: userId, body: command.body.trim(), mentions: JSON.stringify(mentions), pageLinks: JSON.stringify(pageLinks), dates: JSON.stringify(command.dates ?? []), createdAt: ts });
      for (const file of command.files) await tx.insert(commentFiles).values({ ...file, id: randomUUID(), commentId });
      await tx.update(commentThreads).set({ updatedAt: ts, resolved: false }).where(eq(commentThreads.id, threadId));
      await tx.insert(commentStates).values({ id: randomUUID(), threadId, userId, readAt: ts }).onConflictDoUpdate({ target: [commentStates.threadId, commentStates.userId], set: { readAt: ts } });
    } else if (command.action === "edit") {
      await tx.update(comments).set({ body: command.body, editedAt: ts }).where(eq(comments.id, message!.id));
      await tx.update(commentThreads).set({ updatedAt: ts }).where(eq(commentThreads.id, thread!.id));
    } else if (command.action === "deleteMessage") {
      await tx.delete(commentFiles).where(eq(commentFiles.commentId, message!.id));
      await tx.delete(commentReactions).where(eq(commentReactions.commentId, message!.id));
      await tx.delete(comments).where(eq(comments.id, message!.id));
      const remaining = await tx.select({ id: comments.id }).from(comments).where(eq(comments.threadId, thread!.id)).limit(1);
      if (!remaining.length) {
        await tx.delete(commentStates).where(eq(commentStates.threadId, thread!.id));
        await tx.delete(commentThreads).where(eq(commentThreads.id, thread!.id));
      } else await tx.update(commentThreads).set({ updatedAt: ts }).where(eq(commentThreads.id, thread!.id));
    } else if (command.action === "resolve") {
      await tx.update(commentThreads).set({ resolved: command.value, updatedAt: ts }).where(eq(commentThreads.id, thread!.id));
    } else if (command.action === "unread" || command.action === "mute") {
      const change = command.action === "unread" ? { readAt: command.value ? null : ts } : { muted: command.value };
      await tx.insert(commentStates).values({ id: randomUUID(), threadId: thread!.id, userId, ...change }).onConflictDoUpdate({ target: [commentStates.threadId, commentStates.userId], set: change });
    } else if (command.action === "react") {
      const where = and(eq(commentReactions.commentId, message!.id), eq(commentReactions.userId, userId), eq(commentReactions.emoji, command.emoji));
      const existing = await tx.select().from(commentReactions).where(where).limit(1);
      if (existing.length) await tx.delete(commentReactions).where(where);
      else await tx.insert(commentReactions).values({ id: randomUUID(), commentId: message!.id, userId, emoji: command.emoji });
    }
  });
  void page;
  return listComments(userId, pageId);
}

export async function previewCommentPage(userId: string, pageId: string, linkedPageId: string) {
  const current = await access(userId, pageId);
  const linked = await getPageForUser(userId, linkedPageId);
  if (!linked || linked.page.workspaceId !== current.page.workspaceId) throw missing();
  return { title: linked.page.title, icon: linked.page.icon, excerpt: linked.page.plainText.slice(0, 450) };
}
