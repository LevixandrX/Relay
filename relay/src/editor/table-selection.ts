import type {Editor} from '@tiptap/core';
import type {EditorState,SelectionBookmark} from '@tiptap/pm/state';
import {CellSelection,TableMap,selectedRect,mergeCells,splitCell} from '@tiptap/pm/tables';
import {closeHistory} from '@tiptap/pm/history';
import {validColor} from './block-appearance';
export function selectedCells(state:EditorState,bookmark?:SelectionBookmark){
  if(bookmark){try{state=state.apply(state.tr.setSelection(bookmark.resolve(state.doc)));}catch{return null;}}
  let selection=state.selection;
  if(!(selection instanceof CellSelection)){
    if(!selection.empty)return null;
    const {$from}=selection;let depth=$from.depth;
    while(depth>0&&!['tableCell','tableHeader'].includes($from.node(depth).type.name))depth--;
    if(!depth)return null;selection=CellSelection.create(state.doc,$from.before(depth));state=state.apply(state.tr.setSelection(selection));
  }
  const cells:{pos:number;node:typeof state.doc}[]=[];(selection as CellSelection).forEachCell((node,pos)=>cells.push({pos,node}));
  if(!cells.length)return null;
  const rect=selectedRect(state),tablePos=rect.tableStart-1;
  return{state,table:rect.table,tablePos,map:TableMap.get(rect.table),rect,cells,bookmark:selection.getBookmark()};
}
export function colorTableCells(editor:Editor,bookmark:SelectionBookmark,kind:'text'|'background',value:string|null){
  if(value!==null&&!validColor(value))return false;const context=selectedCells(editor.state,bookmark);if(!context)return false;
  const attr=kind==='text'?'cellTextColor':'cellBackground',tr=context.state.tr;
  for(const {pos,node} of context.cells)tr.setNodeMarkup(pos,undefined,{...node.attrs,[attr]:value});
  editor.view.dispatch(closeHistory(tr));return true;
}
export function canCellAction(state:EditorState,bookmark:SelectionBookmark,action:'mergeCells'|'splitCell'|'clearContents'){
  const context=selectedCells(state,bookmark);if(!context)return false;
  if(action==='clearContents')return true;
  return (action==='mergeCells'?mergeCells:splitCell)(context.state);
}
export function runCellAction(editor:Editor,bookmark:SelectionBookmark,action:'mergeCells'|'splitCell'|'clearContents'){
  const context=selectedCells(editor.state,bookmark);if(!context||!canCellAction(editor.state,bookmark,action))return false;
  if(action==='clearContents'){const tr=context.state.tr;for(const {pos,node} of context.cells.slice().sort((a,b)=>b.pos-a.pos)){tr.setNodeMarkup(pos,undefined,{...node.attrs,cellTextColor:null,cellBackground:null});tr.replaceWith(pos+1,pos+node.nodeSize-1,context.state.schema.nodes.paragraph.create());}editor.view.dispatch(closeHistory(tr));return true;}
  return (action==='mergeCells'?mergeCells:splitCell)(context.state,tr=>editor.view.dispatch(closeHistory(tr)));
}
