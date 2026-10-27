import assert from "node:assert/strict";
import { commentDraftScope, emptyCommentDraft, hasCommentDraft, newCommentDraftKey, readCommentDrafts, removeCommentDraft, saveCommentDraft, stageCommentDraft } from "../src/editor/comment-drafts";
import { sideDropAt } from "../src/editor/drop-zones";

const storage = new Map<string,string>();
let blocked = false;
Object.defineProperty(globalThis,"sessionStorage",{ value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { if (blocked) throw new Error("Quota exceeded"); storage.set(key,value); },
  removeItem: (key: string) => storage.delete(key),
} });
const scope = commentDraftScope("author", "page"), other = commentDraftScope("other", "page");
const anchor = { blockId: "blk_first0001", quote: "Quoted text", anchorOffset: 0 }, key = newCommentDraftKey(anchor);
const first = { ...emptyCommentDraft(), body: "An unfinished comment" };
saveCommentDraft(scope,{ key,anchor,value:first });
saveCommentDraft(scope,{ key:"thread-two",value:{...first,body:"Independent reply"} });
assert.equal(readCommentDrafts(scope).length,2);
assert.deepEqual(readCommentDrafts(other),[]);
assert.deepEqual(readCommentDrafts(commentDraftScope("author","another-page")),[]);
stageCommentDraft(scope,{ key,anchor,value:{...first,body:"Just typed"} });
assert.equal(readCommentDrafts(scope).find(d=>d.key===key)!.value.body,"Just typed");
assert.equal(JSON.parse(storage.get(scope)!)[0].value.body,"An unfinished comment");
saveCommentDraft(scope,readCommentDrafts(scope).find(d=>d.key===key)!);
assert.equal(JSON.parse(storage.get(scope)!).find((d:{key:string})=>d.key===key).value.body,"Just typed");
removeCommentDraft(scope,key);
assert.equal(readCommentDrafts(scope)[0].key,"thread-two");
assert.equal(JSON.parse(storage.get(scope)!).length,1);
saveCommentDraft(scope,{key:"thread-two",value:emptyCommentDraft()});
assert.equal(storage.has(scope),false);
blocked=true;
const files=[{name:"attachment.txt",type:"text/plain",size:3,data:"aGV5"}];
saveCommentDraft(scope,{key,anchor,value:{...emptyCommentDraft(),files}});
assert.deepEqual(readCommentDrafts(scope)[0].value.files,files);
blocked=false;
const restored = commentDraftScope("restored","page");
storage.set(restored,JSON.stringify([{key,anchor,value:first}]));
assert.deepEqual(readCommentDrafts(restored)[0].anchor,anchor);
assert.equal(readCommentDrafts(restored)[0].value.body,first.body);
assert.equal(newCommentDraftKey({...anchor,anchorOffset:10})===key,false);
assert.equal(hasCommentDraft({...emptyCommentDraft(),files}),true);
assert.equal(hasCommentDraft(emptyCommentDraft()),false);
assert.equal(sideDropAt(110,100,600),null);
assert.equal(sideDropAt(610,100,600),null);
assert.equal(sideDropAt(79,100,600),"left");
assert.equal(sideDropAt(621,100,600),"right");
assert.equal(sideDropAt(616,100,600,"right"),"right");
assert.equal(sideDropAt(603,100,600,"right"),null);
// A 24px column gap still admits a side drop between its two text edges.
assert.equal(sideDropAt(611,100,600,undefined,10),'right');
assert.equal(sideDropAt(89,100,600,undefined,10),'left');
assert.equal(sideDropAt(590,100,600,undefined,10),null);
console.log("21 draft isolation, recovery and drag zone checks passed.");
