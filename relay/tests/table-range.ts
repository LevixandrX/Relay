import assert from 'node:assert/strict';
import {getSchema,type Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {TableMap,CellSelection,mergeCells,fixTables} from '@tiptap/pm/tables';
import {richExtensions} from '../src/editor/rich-blocks';
import {BlockAppearance} from '../src/editor/block-appearance';
import {reorderedTable,moveTableRange,tableAxisRange} from '../src/editor/table-range';
import {parseDoc} from '../src/domain/blocks/schema';
const schema=getSchema([StarterKit,BlockAppearance,...richExtensions(()=>undefined)]);
const table=schema.nodes.table.create(null,['A','B','C','D'].map((r,ri)=>schema.nodes.tableRow.create(null,[1,2,3,4].map((c,ci)=>schema.nodes.tableCell.create({colwidth:[100+c*20],cellBackground:ci===1?'#cca84b':null},schema.nodes.paragraph.create({blockId:'blk_test-cell-'+r+c},schema.text(r+c)))))));
for(const axis of ['row','column'] as const){
 const moved=reorderedTable(table,axis,0,2,4)!;
 assert.deepEqual(axis==='row'?Array.from({length:4},(_,i)=>moved.table.child(i).firstChild!.textContent):Array.from({length:4},(_,i)=>moved.table.firstChild!.child(i).textContent),axis==='row'?['C1','D1','A1','B1']:['A3','A4','A1','A2']);
 assert.equal(TableMap.get(moved.table).problems,null);parseDoc(schema.nodes.doc.create(null,moved.table).toJSON());
 assert.ok(reorderedTable(moved.table,axis,2,4,0)!.table.eq(table));
 const original=schema.nodes.doc.create(null,table);let state=EditorState.create({schema,doc:original,plugins:[history()]});
 const editor={get state(){return state;},view:{dispatch(tr:Parameters<typeof state.apply>[0]){state=state.apply(tr);}}} as unknown as Editor;
 assert.ok(moveTableRange(editor,0,axis,0,2,4));assert.ok(state.selection instanceof CellSelection);assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(original));
}
assert.deepEqual(reorderedTable(table,'column',0,2,4)!.table.firstChild!.child(3).attrs.colwidth,[140]);
assert.equal(reorderedTable(table,'column',0,2,4)!.table.firstChild!.child(3).attrs.cellBackground,'#cca84b');
assert.equal(reorderedTable(table,'column',0,2,4)!.table.firstChild!.child(3).firstChild!.attrs.blockId,'blk_test-cell-A2');
for(const axis of ['row','column'] as const){
 let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,table)}),map=TableMap.get(table);
 state=state.apply(state.tr.setSelection(CellSelection.create(state.doc,1+map.map[0],1+map.map[axis==='row'?4:1])));mergeCells(state,tr=>{state=state.apply(tr);});
 const repaired=fixTables(state);if(repaired)state=state.apply(repaired);const merged=state.doc.firstChild!;assert.deepEqual(tableAxisRange(merged,axis,0),{start:0,end:2});
 const moved=reorderedTable(merged,axis,0,1,4)!;assert.equal(TableMap.get(moved.table).problems,null);parseDoc(schema.nodes.doc.create(null,moved.table).toJSON());
 assert.ok(reorderedTable(moved.table,axis,2,4,0)!.table.eq(merged));
}
assert.equal(reorderedTable(table,'column',0,2,1),null);assert.equal(reorderedTable(table,'row',0,0,4),null);assert.equal(reorderedTable(table,'row',-1,2,4),null);
console.log('table range groups, merged units, attributes and undo passed');
