import assert from 'node:assert/strict';
import {getSchema,type Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {TableMap,mergeCells,CellSelection} from '@tiptap/pm/tables';
import {richExtensions} from '../src/editor/rich-blocks';
import {BlockAppearance} from '../src/editor/block-appearance';
import {moveAxis,runAxisAction,canAxisAction,resizeTable,selectAxis} from '../src/editor/table-axis';
import {parseDoc} from '../src/domain/blocks/schema';
import {Toggle} from '../src/editor/toggle';
const schema=getSchema([StarterKit,BlockAppearance,...richExtensions(()=>undefined)]),p=(s='')=>schema.nodes.paragraph.create(null,s?schema.text(s):null),cell=(s:string)=>schema.nodes.tableCell.create(null,p(s));
const table=schema.nodes.table.create(null,['A','B','C'].map(r=>schema.nodes.tableRow.create(null,[1,2,3].map(c=>cell(r+c))))),original=schema.nodes.doc.create(null,[p('Before'),table,p('After')]),pos=original.firstChild!.nodeSize;
let state=EditorState.create({schema,doc:original,plugins:[history()]}),checks=0;
const editor={schema,get state(){return state;},view:{dispatch(tr:Parameters<typeof state.apply>[0]){state=state.apply(tr);state.doc.check();parseDoc(state.doc.toJSON());}},commands:{focus(){}}} as unknown as Editor;
const reset=()=>{state=EditorState.create({schema,doc:original,plugins:[history()]});};
const rows=()=>{const t=state.doc.nodeAt(pos)!;return Array.from({length:t.childCount},(_,i)=>t.child(i).textContent);};
for(const axis of ['row','column'] as const){reset();assert.ok(moveAxis(editor,pos,axis,0,2));assert.deepEqual(axis==='row'?rows():Array.from({length:3},(_,i)=>state.doc.nodeAt(pos)!.firstChild!.child(i).textContent),axis==='row'?['B1B2B3','C1C2C3','A1A2A3']:['A2','A3','A1']);assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(original));checks++;}
for(const axis of ['row','column'] as const){reset();assert.ok(runAxisAction(editor,pos,axis,1,'duplicate'));assert.equal(axis==='row'?state.doc.nodeAt(pos)!.childCount:TableMap.get(state.doc.nodeAt(pos)!).width,4);assert.equal(axis==='row'?state.doc.nodeAt(pos)!.child(2).textContent:state.doc.nodeAt(pos)!.firstChild!.child(2).textContent,axis==='row'?'B1B2B3':'A2');assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(original));checks++;}
reset();runAxisAction(editor,pos,'row',1,'clearContents');assert.equal(rows()[1],'');assert.equal(rows()[0],'A1A2A3');assert.equal(rows()[2],'C1C2C3');assert.ok(undo(state,editor.view.dispatch));checks++;
reset();runAxisAction(editor,pos,'column',0,'header');assert.equal(state.doc.nodeAt(pos)!.child(1).firstChild!.type.name,'tableHeader');runAxisAction(editor,pos,'column',0,'header');assert.equal(state.doc.nodeAt(pos)!.child(1).firstChild!.type.name,'tableCell');checks++;
reset();assert.equal(canAxisAction(state,pos,'row',0,'moveBefore'),false);assert.equal(canAxisAction(state,pos,'column',2,'moveAfter'),false);checks++;
for(const axis of ['row','column'] as const){reset();resizeTable(editor,pos,axis,5);assert.equal(axis==='row'?state.doc.nodeAt(pos)!.childCount:TableMap.get(state.doc.nodeAt(pos)!).width,5);assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(original));resizeTable(editor,pos,axis,1);assert.ok(state.doc.eq(original));resizeTable(editor,pos,axis,5);resizeTable(editor,pos,axis,2);assert.equal(axis==='row'?state.doc.nodeAt(pos)!.childCount:TableMap.get(state.doc.nodeAt(pos)!).width,3);checks++;}
reset();const map=TableMap.get(table);state=state.apply(state.tr.setSelection(CellSelection.create(state.doc,pos+1+map.map[0],pos+1+map.map[1])));mergeCells(state,tr=>editor.view.dispatch(tr));assert.equal(canAxisAction(state,pos,'row',0,'duplicate'),false);runAxisAction(editor,pos,'row',0,'clearContents');state.doc.check();parseDoc(state.doc.toJSON());checks++;
reset();assert.ok(selectAxis(state,pos,'row',2)?.selection instanceof CellSelection);assert.equal(selectAxis(state,pos,'column',99),null);checks++;
reset();assert.equal(moveAxis(editor,pos,'row',0,99),false);assert.equal(moveAxis(editor,pos,'column',0,-1),false);checks++;
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.table.create(null,schema.nodes.tableRow.create(null,cell('Last cell')))),plugins:[history()]});assert.ok(runAxisAction(editor,0,'row',0,'delete'));assert.equal(state.doc.firstChild!.type.name,'paragraph');assert.ok(undo(state,editor.view.dispatch));assert.equal(state.doc.firstChild!.textContent,'Last cell');checks++;
const title=schema.nodes.toggleTitle.create(null,schema.text('Title tail')),body=schema.nodes.toggleContent.create(null,p()),toggle=schema.nodes.toggle.create({open:true},[title,body]);
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,toggle)});state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,7)));
const keys=Toggle.config.addKeyboardShortcuts!.call({editor} as never);assert.ok(keys.Enter!({editor}));assert.equal(state.doc.firstChild!.firstChild!.textContent,'Title');assert.equal(state.doc.firstChild!.lastChild!.textContent,' tail');checks++;
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.toggle.create({open:true},[title,body]))});state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,title.nodeSize+3)));assert.ok(keys.Enter!({editor}));assert.equal(state.doc.lastChild!.type.name,'paragraph');checks++;
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.toggle.create({open:false},[title,body]))});state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,7)));assert.ok(keys.Enter!({editor}));assert.equal(state.doc.childCount,2);assert.equal(state.doc.lastChild!.firstChild!.textContent,' tail');assert.equal(state.doc.lastChild!.attrs.open,false);checks++;
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.toggle.create({open:true},[title,schema.nodes.toggleContent.create(null,p('Keep body'))]))});state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,2)));assert.ok(keys.Backspace!({editor}));assert.equal(state.doc.childCount,2);assert.equal(state.doc.lastChild!.textContent,'Keep body');checks++;
reset();const gesture={time:Date.now(),changed:false};resizeTable(editor,pos,'row',4,gesture);resizeTable(editor,pos,'row',6,gesture);resizeTable(editor,pos,'column',5,gesture);assert.equal(state.doc.nodeAt(pos)!.childCount,6);assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(original));checks++;
reset();const moving={time:Date.now(),changed:false};moveAxis(editor,pos,'row',0,2,moving);moveAxis(editor,pos,'row',2,1,moving);assert.deepEqual(rows(),['B1B2B3','A1A2A3','C1C2C3']);assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(original));checks++;
console.log(`${checks} table/toggle interaction checks passed`);
