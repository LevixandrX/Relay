import assert from "node:assert/strict";
import { Schema } from "@tiptap/pm/model";
import { captureCaret, pageResumeKey, parsePageResume, resumeSelection } from "../src/editor/page-resume";

const schema = new Schema({ nodes: {
  doc: { content: "paragraph+" },
  paragraph: { content: "text*", attrs: { blockId: {default:null} } }, text: {},
} });
const p = (id: string, text: string) => schema.nodes.paragraph.create({blockId:id}, schema.text(text));
const original = schema.nodes.doc.create(null, [p("a","first"),p("b","last writing")]);
const caret = captureCaret(original, 12);
assert.equal(caret.block, "b");
const reordered = schema.nodes.doc.create(null, [p("b","last writing"),p("a","first")]);
assert.equal(resumeSelection(reordered,caret).head, 5, "caret follows its block after a reorder");
const shortened = schema.nodes.doc.create(null, [p("b","x")]);
assert.equal(resumeSelection(shortened,caret).head, 2, "caret is clamped after text was shortened");
const deleted = schema.nodes.doc.create(null, [p("a","first")]);
assert.equal(resumeSelection(deleted,caret).head, 6, "deleted block has a safe fallback");
assert.notEqual(pageResumeKey("a","bc"),pageResumeKey("ab","c"));
assert.notEqual(pageResumeKey("account-a","page"),pageResumeKey("account-b","page"));
const state = {version:1,scroll:1900,viewport:{block:"b",offset:-8},caret,editing:true};
assert.deepEqual(parsePageResume(JSON.stringify(state)),state);
for (const value of [null,"{",JSON.stringify({...state,scroll:-1}),JSON.stringify({...state,caret:{}}),JSON.stringify({...state,caret:{...caret,offset:1.5}}),JSON.stringify({...state,viewport:{block:"b"}})]) assert.equal(parsePageResume(value),null);
console.log("Page resume: block movement, deletion, text shortening, account isolation and storage validation passed");
