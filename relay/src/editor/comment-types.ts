import type { CustomEmoji } from "../lib/emoji";
export type CommentPerson = { id: string; name: string; avatarUrl?: string | null; role?: "owner" | "editor" | "viewer" | "guest" };
export type DraftAnchor = { blockId: string; quote: string; anchorOffset: number | null };
export type CommentPage = { id: string; title: string; icon?: string | null };
export type CommentFile = { id: string; name: string; size: number; type: string };
export type FileUpload = Omit<CommentFile, "id"> & { data: string };
export type CommentMessage = {
  id: string; author: CommentPerson; body: string; createdAt: string; editedAt: string | null;
  mentions: CommentPerson[]; pages: CommentPage[]; files: CommentFile[];
  reactions: { emoji: string; userIds: string[] }[]; dates?: string[];
};
export type CommentThread = {
  id: string; blockId: string; quote: string; anchorOffset: number | null;
  resolved: boolean; updatedAt: string; unread: boolean; muted: boolean; messages: CommentMessage[];
};
export type CommentData = { threads: CommentThread[]; people: CommentPerson[]; pages: CommentPage[]; me: CommentPerson; customEmojis?: CustomEmoji[] };
export type CommentDraft = { body: string; mentions: string[]; pages: string[]; files: FileUpload[]; dates?: string[] };
export type CommentCommand =
  | { action: "createEmoji"; name: string; data: string; type: "image/png" }
  | ({ action: "create"; blockId: string; quote: string; anchorOffset: number | null } & CommentDraft)
  | ({ action: "reply"; threadId: string } & CommentDraft)
  | { action: "edit"; threadId: string; messageId: string; body: string }
  | { action: "deleteMessage"; threadId: string; messageId: string }
  | { action: "resolve"; threadId: string; value: boolean }
  | { action: "unread"; threadId: string; value: boolean }
  | { action: "mute"; threadId: string; value: boolean }
  | { action: "react"; threadId: string; messageId: string; emoji: string };
export type CommentContext = {
  pageId: string;
  identity: string;
  request: <T>(suffix: string, init?: RequestInit) => Promise<T>;
  blockLink: (blockId: string, threadId?: string) => string;
  openPage: (pageId: string) => void;
};
