import assert from 'node:assert/strict';
import {getSchema,type Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState,NodeSelection,TextSelection} from '@tiptap/pm/state';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {richExtensions} from '../src/editor/rich-blocks';
import {BlockCallout} from '../src/editor/block-callout';
import {BlockAppearance} from '../src/editor/block-appearance';
import {CodeBlock} from '../src/editor/code-block';
import {changeBlock,type BlockType} from '../src/editor/block-commands';
import {editorPlaceholder} from '../src/editor/editor-placeholder';
const schema=getSchema([StarterKit.configure({codeBlock:false}),CodeBlock,TaskList,TaskItem,BlockAppearance,BlockCallout,...richExtensions(()=>undefined)]);
let state:EditorState;const editor={schema,get state(){return state;},view:{dispatch(tr:Parameters<EditorState['apply']>[0]){state=state.apply(tr);}},commands:{focus(){}}} as unknown as Editor;
for(const type of ['toggle','code','callout','equation','image','file','table'] as BlockType[]){const source=schema.nodes.paragraph.create(null,schema.text('/'+type));state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[source,schema.nodes.paragraph.create(null,schema.text('After'))])});changeBlock(editor,{pos:0,node:source},type,{from:1,to:source.nodeSize-1});assert.ok(state.selection.from<state.doc.firstChild!.nodeSize,type+' caret must stay in created block');assert.ok(type==='equation'||type==='image'||type==='file'?state.selection instanceof NodeSelection:state.selection instanceof TextSelection);if(type==='toggle'){assert.equal(state.doc.firstChild!.attrs.open,false);assert.equal(state.selection.$from.parent.type.name,'toggleTitle');}if(type==='code')assert.equal(editorPlaceholder({editor,node:state.doc.firstChild!,pos:0},key=>key),'');}
const unavailableEditor={get state(){throw new Error('Placeholder read stale editor state');}} as unknown as Editor;
assert.equal(editorPlaceholder({editor:unavailableEditor,node:schema.nodes.paragraph.create(),pos:5000,hasAnchor:true},key=>key),'placeholder');
assert.equal(editorPlaceholder({editor:unavailableEditor,node:schema.nodes.paragraph.create(),pos:5000,hasAnchor:false},key=>key),'');
console.log('Block creation keeps the caret in text blocks, selects atoms and avoids stale-state reads in placeholders');
