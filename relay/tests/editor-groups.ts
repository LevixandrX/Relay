import assert from 'node:assert/strict';
import {getSchema,type Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {BlockAppearance,applyBlockColor} from '../src/editor/block-appearance';
import {BlockColumn,BlockColumns} from '../src/editor/block-columns';
import {blockAncestor,blockAt,actOnBlock,canMoveBlock,listSelectionTarget,listRowTarget,sameBlockSelection,changeBlock} from '../src/editor/block-commands';
import {columnRowBounds} from '../src/domain/blocks/columns';
import {parseDoc} from '../src/domain/blocks/schema';

const schema=getSchema([StarterKit,TaskList,TaskItem,BlockAppearance,BlockColumn,BlockColumns]);
const p=(id:string)=>schema.nodes.paragraph.create({blockId:id},schema.text(id));
const item=(id:string,color:string|null)=>schema.nodes.listItem.create({blockId:id,blockBackground:color},p(id+'p'));
let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.bulletList.create({blockId:'blk_listroot1',blockBackground:'#69ac83'},[item('blk_listitem1','#69ac83'),item('blk_listitem2','#6aabe4')])),plugins:[history()]});
const editor={schema,get state(){return state;},view:{dispatch(tr:Parameters<typeof state.apply>[0]){state=state.apply(tr);}},commands:{focus(){}}} as unknown as Editor;
const target=(id:string)=>{let pos=-1;state.doc.descendants((node,at)=>{if(node.attrs.blockId===id)pos=at;});assert.ok(pos>=0,id);return blockAt(editor,pos,true)!;};
const original=state.doc;
assert.equal(blockAncestor(editor,target('blk_listitem2'),'bulletList')!.node.attrs.blockId,'blk_listroot1');
applyBlockColor(editor,target('blk_listroot1'),'background','#d5b44b');
assert.equal(state.doc.firstChild!.attrs.blockBackground,'#d5b44b');
state.doc.firstChild!.descendants(node=>{assert.ok(!node.attrs.blockBackground);});
assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(original));
applyBlockColor(editor,target('blk_listitem2'),'background','#e17676');
assert.equal(target('blk_listitem1').node.attrs.blockBackground,'#69ac83');

const nested=schema.nodes.bulletList.create({blockId:'blk_rootlist01'},[
  schema.nodes.listItem.create({blockId:'blk_parentitem'},[p('blk_parenttext'),schema.nodes.bulletList.create({blockId:'blk_nestedlist'},[item('blk_nesteditem',null)])]),
  item('blk_lastitem01',null),
]);
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[nested,p('blk_following1')])});
assert.equal(listSelectionTarget(editor,target('blk_nesteditem'),'list')!.node.attrs.blockId,'blk_rootlist01');
assert.equal(listSelectionTarget(editor,target('blk_rootlist01'),'item','blk_nesteditem')!.node.attrs.blockId,'blk_nesteditem');
assert.equal(listSelectionTarget(editor,target('blk_nestedlist'),'item','blk_nesteditem')!.node.attrs.blockId,'blk_nesteditem');
assert.ok(!sameBlockSelection(target('blk_parentitem'),target('blk_rootlist01')));
assert.ok(!sameBlockSelection(target('blk_parentitem'),listRowTarget(editor,target('blk_parentitem'))!));
assert.ok(sameBlockSelection(target('blk_lastitem01'),listRowTarget(editor,target('blk_lastitem01'))!));
const ownRow=listRowTarget(editor,target('blk_parentitem'))!;
assert.equal(ownRow.node.type.name,'paragraph');
assert.equal(ownRow.node.textContent,'blk_parenttext');
const childBefore=target('blk_nestedlist').node;
applyBlockColor(editor,ownRow,'background','#d5b44b');
assert.ok(target('blk_nestedlist').node.eq(childBefore));
assert.equal(target('blk_parentitem').node.attrs.blockBackground,null);
const singleList=schema.nodes.bulletList.create(null,nested.firstChild!);
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,singleList)});
assert.ok(sameBlockSelection(blockAt(editor,0,true)!,blockAt(editor,1,true)!));
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[nested,p('blk_following1')])});
changeBlock(editor,target('blk_lastitem01'),'h2');
assert.equal(state.selection.$from.parent.type.name,'heading');
assert.equal(state.selection.$from.parent.attrs.level,2);state.doc.check();
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[schema.nodes.paragraph.create({blockId:'blk_emptyblock'}),p('blk_following2')])});
state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,1)));
changeBlock(editor,target('blk_emptyblock'),'h1');
assert.equal(state.selection.from,1);assert.equal(state.selection.$from.parent.type.name,'heading');

const row=schema.nodes.columns.create({blockId:'blk_columns01',layoutStart:.1,layoutEnd:.9},[
 schema.nodes.column.create({blockId:'blk_column001'},p('blk_paragraph1')),
 schema.nodes.column.create({blockId:'blk_column002'},p('blk_paragraph2')),
]);
state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[p('blk_before001'),row,p('blk_after0001')]),plugins:[history()]});
const before=state.doc;
assert.ok(canMoveBlock(editor,target('blk_column001'),'up'));
actOnBlock(editor,target('blk_column001'),'up');
assert.equal(state.doc.child(1).attrs.blockId,'blk_paragraph1');state.doc.check();parseDoc(state.doc.toJSON());
assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(before));
assert.ok(canMoveBlock(editor,target('blk_paragraph1'),'up'));
actOnBlock(editor,target('blk_paragraph1'),'up');
assert.equal(state.doc.child(1).attrs.blockId,'blk_paragraph1');state.doc.check();parseDoc(state.doc.toJSON());
assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(before));
actOnBlock(editor,target('blk_columns01'),'down');
assert.equal(state.doc.lastChild!.attrs.blockId,'blk_columns01');state.doc.check();parseDoc(state.doc.toJSON());
assert.ok(undo(state,editor.view.dispatch));assert.ok(state.doc.eq(before));

const work={left:64,right:1360},normal={left:320,right:1040};
assert.deepEqual(columnRowBounds(work,normal,null,null),normal);
assert.deepEqual(columnRowBounds(work,normal,0,1),work);
assert.ok(columnRowBounds(work,normal,.9,.95).right-columnRowBounds(work,normal,.9,.95).left>=240);
for(const attrs of [{layoutStart:-1},{layoutEnd:2},{layoutStart:.9,layoutEnd:.1}])assert.throws(()=>parseDoc({type:'doc',content:[{...row.toJSON(),attrs}]}));
console.log('Groups: scoped colors, whole-list selection, column boundary moves, row move/undo, persisted edges and validation passed');
