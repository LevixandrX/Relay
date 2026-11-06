import assert from 'node:assert/strict';
import {getSchema,type Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {CellSelection,TableMap} from '@tiptap/pm/tables';
import {history,undo} from '@tiptap/pm/history';
import {richExtensions} from '../src/editor/rich-blocks';
import {BlockAppearance} from '../src/editor/block-appearance';
import {selectedCells,colorTableCells,canCellAction,runCellAction} from '../src/editor/table-selection';
import {parseDoc} from '../src/domain/blocks/schema';
const schema=getSchema([StarterKit,BlockAppearance,...richExtensions(()=>undefined)]),p=(text:string)=>schema.nodes.paragraph.create(null,schema.text(text));
const table=schema.nodes.table.create(null,['A','B','C'].map((row,index)=>schema.nodes.tableRow.create(null,[1,2,3].map(col=>schema.nodes[index===0?'tableHeader':'tableCell'].create(null,p(row+col)))))),doc=schema.nodes.doc.create(null,[p('Before'),table,p('After')]),pos=doc.firstChild!.nodeSize,map=TableMap.get(table);
let state=EditorState.create({schema,doc,plugins:[history()]});
const editor={get state(){return state;},view:{dispatch(tr:Parameters<EditorState['apply']>[0]){state=state.apply(tr);state.doc.check();parseDoc(state.doc.toJSON());}}} as unknown as Editor;
assert.equal(selectedCells(state),null);
state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,pos+4)));assert.equal(selectedCells(state)?.cells.length,1);
const select=()=>{state=state.apply(state.tr.setSelection(CellSelection.create(state.doc,pos+1+map.map[0],pos+1+map.map[4])));return state.selection.getBookmark();};
let bookmark=select();assert.equal(selectedCells(state)?.cells.length,4);
assert.ok(colorTableCells(editor,bookmark,'background','#69ac83'));assert.ok(colorTableCells(editor,state.selection.getBookmark(),'text','#6aabe4'));
for(const {node} of selectedCells(state)!.cells){assert.equal(node.attrs.cellBackground,'#69ac83');assert.equal(node.attrs.cellTextColor,'#6aabe4');}
assert.equal(state.doc.nodeAt(pos)!.lastChild!.lastChild!.attrs.cellBackground,null);
assert.ok(undo(state,editor.view.dispatch));assert.equal(selectedCells(state)!.cells[0].node.attrs.cellTextColor,null);assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(doc));
bookmark=select();assert.ok(canCellAction(state,bookmark,'mergeCells'));assert.ok(runCellAction(editor,bookmark,'mergeCells'));assert.equal(selectedCells(state)!.cells[0].node.attrs.colspan,2);assert.equal(selectedCells(state)!.cells[0].node.attrs.rowspan,2);
assert.ok(canCellAction(state,state.selection.getBookmark(),'splitCell'));assert.ok(runCellAction(editor,state.selection.getBookmark(),'splitCell'));for(const row of ['A','B','C'])for(const col of [1,2,3])assert.ok(state.doc.textContent.includes(row+col));
state=EditorState.create({schema,doc,plugins:[history()]});bookmark=select();assert.ok(runCellAction(editor,bookmark,'clearContents'));assert.ok(selectedCells(state)!.cells.every(({node})=>!node.textContent));assert.ok(canCellAction(state,state.selection.getBookmark(),'clearContents'));assert.ok(state.doc.textContent.includes('C3'));assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(doc));
assert.equal(colorTableCells(editor,state.selection.getBookmark(),'background','red'),false);
state=EditorState.create({schema,doc,plugins:[history()]});bookmark=select();colorTableCells(editor,bookmark,'background','#69ac83');colorTableCells(editor,state.selection.getBookmark(),'text','#6aabe4');assert.ok(runCellAction(editor,state.selection.getBookmark(),'clearContents'));for(const {node} of selectedCells(state)!.cells){assert.equal(node.textContent,'');assert.equal(node.attrs.cellBackground,null);assert.equal(node.attrs.cellTextColor,null);}
console.log('Cell actions: caret and rectangle selection, text/background colors, merge/split, clear and undo passed');
