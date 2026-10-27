import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
async function run() {
const { db, client } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { applyComment, listComments, readCommentFile, previewCommentPage } = await import("../src/domain/comments/repo");
const { commentCommand } = await import("../src/domain/comments/schema");
const { parseDoc } = await import("../src/domain/blocks/schema");
const { recordBlockActivity, readBlockActivity } = await import("../src/domain/blocks/activity");
const { updatePage, getPageForUser } = await import("../src/domain/pages/repo");
let passed = 0;
async function denied(operation: () => Promise<unknown>, status: number) { await assert.rejects(operation, (error: unknown) => (error as { status: number }).status === status); passed++; }
const ts = new Date().toISOString();
try {
  await db.insert(schema.users).values(["owner", "editor", "viewer", "outsider"].map((id) => ({ id, email: `${id}@relay.test`, name: id, createdAt: ts })));
  await db.insert(schema.workspaces).values([{ id: "one", name: "One", slug: "one", createdBy: "owner", createdAt: ts }, { id: "two", name: "Two", slug: "two", createdBy: "outsider", createdAt: ts }]);
  await db.insert(schema.memberships).values([...["owner", "editor", "viewer"].map((id) => ({ id, workspaceId: "one", userId: id, role: id, createdAt: ts })), { id: "outsider", workspaceId: "two", userId: "outsider", role: "owner", createdAt: ts }]);
  await db.insert(schema.pages).values([...["p1", "p2"].map((id) => ({ id, workspaceId: "one", title: id, content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: { blockId: "blk_12345678" }, content: [{ type: "text", text: "A block" }] }] }), createdBy: "owner", createdAt: ts, updatedAt: ts })), { id: "foreign", workspaceId: "two", title: "Foreign", content: '{"type":"doc"}', createdBy: "outsider", createdAt: ts, updatedAt: ts }]);
  const create = { action: "create" as const, blockId: "blk_12345678", quote: "A block", anchorOffset: null, body: "First comment", mentions: ["editor"], pages: ["p2"], files: [{ name: "notes.txt", type: "text/plain", size: 5, data: "aGVsbG8=" }] };
  let data = await applyComment("owner", "p1", commentCommand.parse(create));
  const thread = data.threads[0], message = thread.messages[0], file = message.files[0];
  assert.equal(message.author.role,"owner"); assert.equal(data.people.find((p)=>p.id==="viewer")!.role,"viewer"); passed += 2;
  assert.equal(message.mentions[0].name, "editor"); assert.equal(message.pages[0].id, "p2"); assert.equal(thread.unread, false); assert.equal((message.files[0] as unknown as { data?: string }).data, undefined); passed += 4;
  assert.equal((await readCommentFile("viewer", "p1", file.id)).data, "aGVsbG8="); passed++;
  assert.equal((await previewCommentPage("owner", "p1", "p2")).title, "p2"); passed++;
  await denied(() => previewCommentPage("owner", "p1", "foreign"), 404);
  await denied(() => listComments("outsider", "p1"), 404);
  await denied(() => readCommentFile("outsider", "p1", file.id), 404);
  await denied(() => readCommentFile("owner", "p2", file.id), 404);
  await denied(() => applyComment("viewer", "p1", create), 403);
  await denied(() => applyComment("owner", "p1", { ...create, pages: ["foreign"] }), 400);
  await denied(() => applyComment("owner", "p1", { ...create, mentions: ["outsider"] }), 400);
  await denied(() => applyComment("owner", "p1", { ...create, files: [{ ...create.files[0], size: 6 }] }), 400);
  await denied(() => applyComment("editor", "p2", { action: "resolve", threadId: thread.id, value: true }), 404);
  await denied(() => applyComment("editor", "p1", { action: "edit", threadId: thread.id, messageId: message.id, body: "Changed" }), 403);
  await denied(() => applyComment("editor", "p1", { action: "deleteMessage", threadId: thread.id, messageId: message.id }), 403);
  data = await applyComment("editor", "p1", { action: "reply", threadId: thread.id, body: "Reply", files: [], pages: [], mentions: [] });
  assert.equal(data.threads[0].messages.length, 2); assert.equal(data.threads[0].messages[1].author.id, "editor"); passed += 2;
  assert.equal(data.threads[0].messages[1].author.role,"editor"); passed++;
  assert.equal((await listComments("viewer", "p1")).threads[0].unread, true); passed++;
  data = await applyComment("viewer", "p1", { action: "unread", threadId: thread.id, value: false }); assert.equal(data.threads[0].unread, false); passed++;
  data = await applyComment("viewer", "p1", { action: "mute", threadId: thread.id, value: true }); assert.equal(data.threads[0].muted, true); passed++;
  await denied(() => applyComment("viewer", "p1", { action: "react", threadId: thread.id, messageId: message.id, emoji: "👍" }), 403);
  data = await applyComment("editor", "p1", { action: "react", threadId: thread.id, messageId: message.id, emoji: "👍" }); assert.deepEqual(data.threads[0].messages[0].reactions[0].userIds, ["editor"]); passed++;
  data = await applyComment("editor", "p1", { action: "react", threadId: thread.id, messageId: message.id, emoji: "👍" }); assert.equal(data.threads[0].messages[0].reactions.length, 0); passed++;
  data = await applyComment("owner", "p1", { action: "edit", threadId: thread.id, messageId: message.id, body: "Edited" }); assert.equal(data.threads[0].messages[0].body, "Edited"); assert.ok(data.threads[0].messages[0].editedAt); passed += 2;
  const emojiImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRXsAAAAASUVORK5CYII=";
  const emojiCommand = { action: "createEmoji" as const, name: "relay-test", type: "image/png" as const, data: emojiImage };
  await denied(() => applyComment("viewer", "p1", emojiCommand), 403);
  await denied(() => applyComment("outsider", "p1", emojiCommand), 404);
  await denied(() => applyComment("owner", "p1", { ...emojiCommand, data: "aGVsbG8=" }), 400);
  data = await applyComment("owner", "p1", commentCommand.parse(emojiCommand));
  const custom = data.customEmojis![0]; assert.equal(custom.name, "relay-test"); assert.equal((await listComments("editor", "p2")).customEmojis![0].id, custom.id); passed += 2;
  assert.equal((await listComments("outsider", "foreign")).customEmojis!.length, 0); passed++;
  await denied(() => applyComment("owner", "p1", emojiCommand), 400);
  data = await applyComment("editor", "p1", { action: "react", threadId: thread.id, messageId: message.id, emoji: `custom:${custom.id}` }); assert.equal(data.threads[0].messages[0].reactions[0].emoji, `custom:${custom.id}`); passed++;
  const unknown = "custom:00000000-0000-0000-0000-000000000000";
  await denied(() => applyComment("owner", "p1", { action: "react", threadId: thread.id, messageId: message.id, emoji: unknown }), 404);
  data = await applyComment("owner", "p1", commentCommand.parse({ action: "reply", threadId: thread.id, body: "Date @2026-10-05", dates: ["2026-10-05"], pages: [], mentions: [], files: [] })); assert.deepEqual(data.threads[0].messages.at(-1)!.dates, ["2026-10-05"]); passed++;
  assert.equal(commentCommand.safeParse({ ...create, dates: ["2026-02-31"] }).success, false); passed++;
  assert.equal(commentCommand.safeParse({ action: "react", threadId: thread.id, messageId: message.id, emoji: "not-an-emoji" }).success, false); passed++;
  const oldDoc = { type: "doc", content: [{ type: "paragraph", attrs: { blockId: "blk_12345678" }, content: [{ type: "text", text: "A block" }] }] };
  const newDoc = { type: "doc", content: [{ ...oldDoc.content[0], content: [{ type: "text", text: "Edited block" }] }] };
  const saved = await updatePage({ userId: "editor", pageId: "p1", content: newDoc, baseUpdatedAt: ts });
  const activity = await readBlockActivity("owner", "p1", "blk_12345678"); assert.equal(activity!.editedBy, "editor"); assert.equal(activity!.editedAt, saved.updatedAt); passed += 2;
  await denied(() => readBlockActivity("outsider", "p1", "blk_12345678"), 404);
  await recordBlockActivity(db, "p1", "owner", newDoc, newDoc, new Date(Date.now()+10000).toISOString()); assert.equal((await readBlockActivity("owner", "p1", "blk_12345678"))!.editedBy, "editor"); passed++;
  const movedDoc = { type: "doc", content: [{ type: "paragraph", attrs: { blockId: "blk_other12345" }, content: [{ type: "text", text: "Other" }] }, ...newDoc.content] };
  await recordBlockActivity(db, "p1", "owner", newDoc, movedDoc, ts); assert.equal((await readBlockActivity("owner", "p1", "blk_12345678"))!.editedBy, "editor"); passed++;
  data = await applyComment("editor", "p1", { action: "resolve", threadId: thread.id, value: true }); assert.equal(data.threads[0].resolved, true); passed++;
  data = await applyComment("editor", "p1", { action: "resolve", threadId: thread.id, value: false }); assert.equal(data.threads[0].resolved, false); passed++;
  data = await applyComment("owner", "p1", { action: "deleteMessage", threadId: thread.id, messageId: data.threads[0].messages[1].id }); assert.equal(data.threads[0].messages.length, 2); passed++;
  data = await applyComment("owner", "p1", { action: "deleteMessage", threadId: thread.id, messageId: message.id }); await applyComment("owner", "p1", { action: "deleteMessage", threadId: thread.id, messageId: data.threads[0].messages[0].id }); assert.equal((await listComments("owner", "p1")).threads.length, 0); passed++;
  await denied(() => readCommentFile("owner", "p1", file.id), 404);
  assert.equal(commentCommand.safeParse({ ...create, files: [{ ...create.files[0], size: 3 * 1024 * 1024 }] }).success, false); passed++;
  assert.throws(() => parseDoc({ type: "doc", content: [{ type: "paragraph", attrs: { textColor: "url(javascript:test)" } }] })); passed++;
  parseDoc({ type: "doc", content: [{ type: "paragraph", attrs: { textColor: "#123abc", blockBackground: "#ABC123", blockId: "blk_12345678" } }] }); passed++;
  const layout = { type: "doc", content: [{ type: "columns", content: [{ type: "column", attrs: { width: 1.3 }, content: [{ type: "paragraph", attrs: { blockId: "blk_layout0001", blockIndent: 2 }, content: [{ type: "text", text: "Left" }] }] }, { type: "column", attrs: { width: .7 }, content: [{ type: "paragraph", attrs: { blockId: "blk_layout0002" }, content: [{ type: "text", text: "Right" }] }] }] }] };
  const layoutBase = (await getPageForUser("editor", "p2"))!.page.updatedAt;
  await updatePage({ userId: "editor", pageId: "p2", content: layout, baseUpdatedAt: layoutBase });
  assert.deepEqual(JSON.parse((await getPageForUser("editor","p2"))!.page.content),layout); passed++;
  assert.equal((await getPageForUser("editor","p2"))!.page.plainText,"Left Right"); passed++;
  await denied(() => updatePage({ userId: "viewer", pageId: "p2", content: layout, baseUpdatedAt: layoutBase }),403);
  console.log(`${passed} comment domain checks passed (isolated database).`);
} finally {
  client.close();

}

}
async function main() {
  const directory = mkdtempSync(path.join(tmpdir(), "relay-comments-test-"));
  const env = { ...process.env, DATABASE_URL: `file:${path.join(directory, "comments.db")}`, RELAY_COMMENT_TEST_WORKER: "1" };
  try {
    const migration = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/db/migrate.ts"], { env, encoding: "utf8" });
    assert.equal(migration.status, 0, migration.stderr);
    const worker = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "tests/comments-domain.ts"], { env, encoding: "utf8" });
    process.stdout.write(worker.stdout); process.stderr.write(worker.stderr);
    assert.equal(worker.status, 0, "Comment domain tests failed");
  } finally {
    // The worker has exited, releasing SQLite's native Windows file handles.
    for (const name of readdirSync(directory)) unlinkSync(path.join(directory, name));
    rmdirSync(directory);
  }
}
void (process.env.RELAY_COMMENT_TEST_WORKER === "1" ? run() : main()).catch((error) => { console.error(error); process.exitCode = 1; });
