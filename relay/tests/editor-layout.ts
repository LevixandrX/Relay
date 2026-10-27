import assert from "node:assert/strict";
import { getSchema, type Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { EditorState } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import { BlockColumns, BlockColumn } from "../src/editor/block-columns";
import { BlockAppearance } from "../src/editor/block-appearance";
import { actOnBlock, blockAt, moveBlock, moveBlockBeside } from "../src/editor/block-commands";
import { parseDoc, docToPlainText } from "../src/domain/blocks/schema";
import { changedActivityBlocks } from "../src/lib/block-activity";
import {MAX_COLUMNS,resizedColumnPair,columnIndentBase} from '../src/domain/blocks/columns';

const schema = getSchema([StarterKit, TaskList, TaskItem, BlockColumns, BlockColumn, BlockAppearance]);
const p = (id: string, text: string) => ({ type: "paragraph", attrs: { blockId: id }, content: [{ type: "text", text }] });
const fixture = { type: "doc", content: [p("blk_first0001", "First"), p("blk_second001", "Second"), p("blk_third0001", "Third"), { type: "bulletList", attrs: { blockId: "blk_list00001" }, content: [{ type: "listItem", attrs: { blockId: "blk_item00001" }, content: [p("blk_inside001", "Item")] }] }] };
let state = EditorState.create({ schema, doc: schema.nodeFromJSON(fixture), plugins: [history()] });
// Exercise actual ProseMirror transactions without a browser or persistence stub.
const editor = { schema, get state() { return state; }, view: { dispatch(tr: Parameters<typeof state.apply>[0]) { state = state.apply(tr); } }, commands: { focus() {} } } as unknown as Editor;
const target = (id: string) => { let pos = -1; state.doc.descendants((node, at) => { if (node.attrs.blockId === id) pos = at; }); assert.ok(pos >= 0, id); return blockAt(editor, pos, true)!; };
const reset = () => { state = EditorState.create({ schema, doc: schema.nodeFromJSON(fixture), plugins: [history()] }); };
let checks = 0;
const verify = () => {
  state.doc.check(); parseDoc(state.doc.toJSON());
  const texts: string[] = [], ids: string[] = [];
  state.doc.descendants((node) => { if (node.isText) texts.push(node.text!); if (node.attrs.blockId) ids.push(node.attrs.blockId); });
  assert.deepEqual(texts.sort(), ["First", "Item", "Second", "Third"]);
  assert.equal(new Set(ids).size, ids.length); checks++;
};
for (const side of ["left", "right"] as const) {
  reset(); const before = state.doc.toJSON();
  moveBlockBeside(editor, target("blk_second001"), target("blk_first0001"), side);
  assert.equal(state.doc.firstChild!.type.name, "columns");
  assert.equal(state.doc.firstChild!.child(side === "left" ? 0 : 1).firstChild!.attrs.blockId, "blk_second001"); verify();
  assert.ok(undo(state, editor.view.dispatch)); assert.deepEqual(state.doc.toJSON(), before); checks++;
}
reset(); moveBlockBeside(editor, target("blk_second001"), target("blk_first0001"), "right");
moveBlockBeside(editor, target("blk_third0001"), target("blk_second001"), "left");
assert.equal(state.doc.firstChild!.childCount, 3); verify();
const third = target("blk_third0001"); moveBlock(editor, target("blk_second001"), third.pos + third.node.nodeSize, 2); verify();
reset(); moveBlockBeside(editor, target("blk_second001"), target("blk_first0001"), "right");
const after = target("blk_third0001"); moveBlock(editor, target("blk_second001"), after.pos + after.node.nodeSize, 3);
assert.ok(state.doc.firstChild!.type.name !== "columns"); assert.equal(target("blk_second001").node.attrs.blockIndent, 3); verify();
assert.ok(undo(state, editor.view.dispatch)); assert.equal(state.doc.firstChild!.type.name, "columns"); verify();
reset(); moveBlockBeside(editor, target("blk_item00001"), target("blk_first0001"), "left"); verify();
assert.equal(state.doc.firstChild!.child(0).firstChild!.type.name, "bulletList"); checks++;
reset(); moveBlockBeside(editor, target("blk_second001"), target("blk_first0001"), "right"); actOnBlock(editor, target("blk_second001"), "delete");
assert.equal(state.doc.firstChild!.type.name, "paragraph"); assert.ok(undo(state, editor.view.dispatch)); verify();
const column = { type: "column", attrs: { width: 1 }, content: [p("blk_sample001", "Sample")] };
for (const content of [[], [column], Array.from({ length: MAX_COLUMNS+1 }, () => column), [column, { ...column, attrs: { width: -1 } }], [column, { ...column, content: [] }]]) {
  assert.throws(() => parseDoc({ type: "doc", content: [{ type: "columns", content }] })); checks++;
}
assert.throws(() => parseDoc({ type: "doc", content: [{ ...p("blk_sample001", "Sample"), attrs: { blockIndent: 9 } }] })); checks++;
assert.throws(() => parseDoc({ type: "doc", content: [column] })); checks++;
const valid = parseDoc({ type: "doc", content: [{ type: "columns", content: [column, { ...column, attrs: { width: .5 }, content: [p("blk_sample002", "Other")] }] }] });
assert.equal(docToPlainText(valid), "Sample Other"); checks++;
reset(); moveBlockBeside(editor, target("blk_second001"), target("blk_first0001"), "right");
assert.deepEqual(changedActivityBlocks(fixture, state.doc.toJSON()), []); checks++;
const indented = target("blk_first0001");
editor.view.dispatch(state.tr.setNodeMarkup(indented.pos, undefined, { ...indented.node.attrs, blockIndent: 2 }));
assert.deepEqual(changedActivityBlocks(fixture, state.doc.toJSON()), [{ id: "blk_first0001", created: false }]); checks++;
reset();
for(const id of ['blk_first0001','blk_second001']){const item=target(id);editor.view.dispatch(state.tr.setNodeMarkup(item.pos,undefined,{...item.node.attrs,blockIndent:6}));}
moveBlockBeside(editor,target('blk_second001'),target('blk_first0001'),'right');
assert.equal(target('blk_first0001').node.attrs.blockIndent,0);assert.equal(target('blk_second001').node.attrs.blockIndent,0);verify();
assert.equal(columnIndentBase([6,6]),6);assert.equal(columnIndentBase([6,7]),6);assert.equal(columnIndentBase([0,6]),0);assert.equal(columnIndentBase([]),0);checks++;

// Build a ten-column row through the same operation as a side drop, then
// reorder within it and move a block back out. No text or IDs may be lost.
const many=Array.from({length:12},(_,i)=>p(`blk_column00${i.toString().padStart(2,'0')}`,`Column ${i}`));
state=EditorState.create({schema,doc:schema.nodeFromJSON({type:'doc',content:many}),plugins:[history()]});
for(let i=1;i<10;i++){
  moveBlockBeside(editor,target(many[i].attrs.blockId),target(many[i-1].attrs.blockId),'right');
  state.doc.check();parseDoc(state.doc.toJSON());assert.equal(state.doc.firstChild!.childCount,i+1);checks++;
}
moveBlockBeside(editor,target(many[8].attrs.blockId),target(many[1].attrs.blockId),'left');
assert.equal(state.doc.firstChild!.childCount,10);state.doc.check();parseDoc(state.doc.toJSON());checks++;
moveBlock(editor,target(many[3].attrs.blockId),state.doc.content.size);
assert.equal(state.doc.firstChild!.childCount,9);state.doc.check();parseDoc(state.doc.toJSON());
const manyIds:string[]=[];state.doc.descendants(node=>{if(node.attrs.blockId)manyIds.push(node.attrs.blockId);});
assert.deepEqual(manyIds.sort(),many.map(item=>item.attrs.blockId).sort());checks++;
assert.ok(undo(state,editor.view.dispatch));assert.equal(state.doc.firstChild!.childCount,10);checks++;

// Previously successive drags could persist .001, which the save endpoint
// rejects. Exercise shrinking adjacent pairs across the shared API boundary.
assert.throws(()=>parseDoc({type:'doc',content:[{type:'columns',content:[column,{...column,attrs:{width:.001}}]}]}));
let weights=[1,1,1,1];
for(let turn=0;turn<80;turn++){
  const at=turn%3;
  const pair=resizedColumnPair(weights[at],weights[at+1],turn%2?-100:100);
  weights.splice(at,2,...pair);
  parseDoc({type:'doc',content:[{type:'columns',content:weights.map(width=>({...column,attrs:{width}}))}]});checks++;
}
console.log(`${checks} editor layout checks passed.`);
