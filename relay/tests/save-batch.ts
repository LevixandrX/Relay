import assert from "node:assert/strict";
import { test } from "node:test";
import { SaveBatch } from "../src/lib/save-batch";

type Patch = { title?: string; readContent?: () => string; board?: string };

test("autosave reads the latest document once, even during continuous input", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const batch = new SaveBatch<Patch>(1200, 6000);
  const writes: { content?: string; announce: boolean }[] = [];
  let reads = 0;
  const write = async (patch: Patch, announce: boolean) => {
    writes.push({ content: patch.readContent?.(), announce });
  };
  for (let i = 0; i < 12; i++) {
    batch.stage({ readContent: () => { reads++; return `edit ${i}`; } }, write, i !== 0);
    assert.equal(reads, 0);
    t.mock.timers.tick(500);
  }
  await Promise.resolve();
  assert.equal(reads, 1);
  assert.deepEqual(writes, [{ content: "edit 11", announce: true }]);
  await batch.flush();
});

test("flushing joins a write in progress and combines the remaining edits", async () => {
  const batch = new SaveBatch<Patch>();
  const writes: Patch[] = [];
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  batch.stage({ title: "first" }, async (patch) => { writes.push(patch); await gate; });
  const first = batch.flush();
  const write = async (patch: Patch) => { writes.push(patch); };
  batch.stage({ board: "before" }, write);
  batch.stage({ board: "latest", title: "second" }, write);
  const leaving = batch.flush();
  await Promise.resolve();
  assert.deepEqual(writes, [{ title: "first" }]);
  finish();
  await Promise.all([first, leaving]);
  assert.deepEqual(writes, [{ title: "first" }, { title: "second", board: "latest" }]);
});

test("failed changes are retained for the next edit", async () => {
  const batch = new SaveBatch<Patch>();
  batch.stage({ title: "retained", board: "old" }, async () => { throw Error("offline"); });
  await assert.rejects(batch.flush(), /offline/);
  batch.stage({ board: "new" }, async (patch) => {
    assert.deepEqual(patch, { title: "retained", board: "new" });
  });
  await batch.flush();
});
