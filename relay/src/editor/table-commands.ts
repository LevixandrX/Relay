import type {Editor} from '@tiptap/core';
import {TextSelection,type SelectionBookmark,type EditorState} from '@tiptap/pm/state';
import {addRowBefore,addRowAfter,addColumnBefore,addColumnAfter,toggleHeaderRow,toggleHeaderColumn,mergeCells,splitCell,deleteRow,deleteColumn,TableMap,selectedRect,isInTable} from '@tiptap/pm/tables';
import type {BlockTarget} from './block-commands';
export const tableActions=['fitWidth','rowAbove','rowBelow','columnBefore','columnAfter','headerRow','headerColumn','mergeCells','splitCell','deleteRow','deleteColumn'] as const;
export type TableAction=typeof tableActions[number];
const commands={fitWidth:(state:EditorState,dispatch?:((tr:import('@tiptap/pm/state').Transaction)=>void))=>{const {$from}=state.selection;for(let d=$from.depth;d>0;d--)if($from.node(d).type.name==='table'){const table=$from.node(d),pos=$from.before(d),tr=state.tr;table.descendants((cell,offset)=>{if(['tableCell','tableHeader'].includes(cell.type.name))tr.setNodeMarkup(pos+1+offset,undefined,{...cell.attrs,colwidth:null});});dispatch?.(tr);return true;}return false;},rowAbove:addRowBefore,rowBelow:addRowAfter,columnBefore:addColumnBefore,columnAfter:addColumnAfter,headerRow:toggleHeaderRow,headerColumn:toggleHeaderColumn,mergeCells,splitCell,deleteRow,deleteColumn};
export function tableActionState(state:EditorState,target:BlockTarget,bookmark:SelectionBookmark|null){
  const selection=TextSelection.create(state.doc,target.pos+4);
  if(bookmark){try{const saved=bookmark.resolve(state.doc);if(saved.from>target.pos&&saved.to<target.pos+target.node.nodeSize)return state.apply(state.tr.setSelection(saved));}catch{/* Selection may have been invalidated by another transaction. */}}
  return state.apply(state.tr.setSelection(selection));
}
export function canTableAction(state:EditorState,action:TableAction){
  if(!isInTable(state))return false;
  if(action==='deleteRow'||action==='deleteColumn'){const rect=selectedRect(state);if(action==='deleteRow'?rect.top===0&&rect.bottom===rect.map.height:rect.left===0&&rect.right===rect.map.width)return false;}
  const {$from}=state.selection;
  for(let d=$from.depth;d>0;d--)if($from.node(d).type.name==='table'){
    const table=$from.node(d);if(['rowAbove','rowBelow'].includes(action)&&table.childCount>=100)return false;
    if(['columnBefore','columnAfter'].includes(action)&&TableMap.get(table).width>=50)return false;break;
  }
  return commands[action](state);
}
export function runTableAction(editor:Editor,target:BlockTarget,bookmark:SelectionBookmark|null,action:TableAction){return commands[action](tableActionState(editor.state,target,bookmark),tr=>editor.view.dispatch(tr));}
