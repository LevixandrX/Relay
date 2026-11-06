import type {Editor} from '@tiptap/core';
import {type Node as PMNode} from '@tiptap/pm/model';
import {EditorState,TextSelection,type Transaction} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import {TableMap,CellSelection,selectedRect,moveTableRow,moveTableColumn,addRowBefore,addRowAfter,addColumnBefore,addColumnAfter,deleteRow,deleteColumn} from '@tiptap/pm/tables';
export type TableAxis='row'|'column';
export type AxisAction='insertBefore'|'insertAfter'|'duplicate'|'clearContents'|'delete'|'header'|'moveBefore'|'moveAfter';
export function axisCells(table:PMNode,axis:TableAxis,index:number){const map=TableMap.get(table);return [...new Set(axis==='row'?map.map.slice(index*map.width,(index+1)*map.width):Array.from({length:map.height},(_,r)=>map.map[r*map.width+index]))];}
export function selectAxis(state:EditorState,pos:number,axis:TableAxis,index:number){
  const table=state.doc.nodeAt(pos);if(table?.type.name!=='table')return null;const map=TableMap.get(table),count=axis==='row'?map.height:map.width;if(index<0||index>=count)return null;
  const first=axis==='row'?map.map[index*map.width]:map.map[index],last=axis==='row'?map.map[(index+1)*map.width-1]:map.map[(map.height-1)*map.width+index];
  const a=state.doc.resolve(pos+1+first),b=state.doc.resolve(pos+1+last);
  return state.apply(state.tr.setSelection(axis==='row'?CellSelection.rowSelection(a,b):CellSelection.colSelection(a,b)));
}
function move(state:EditorState,pos:number,axis:TableAxis,from:number,to:number,dispatch?:Parameters<ReturnType<typeof moveTableRow>>[1]){const table=state.doc.nodeAt(pos);if(table?.type.name!=='table')return false;const map=TableMap.get(table),count=axis==='row'?map.height:map.width;if(to<0||to>=count||to===from)return false;const selected=selectAxis(state,pos,axis,from);return Boolean(selected&&(axis==='row'?moveTableRow:moveTableColumn)({from,to,pos:pos+2,select:true})(selected,dispatch));}
const emptyCell=(cell:PMNode)=>!cell.attrs.cellBackground&&!cell.attrs.cellTextColor&&cell.childCount===1&&cell.firstChild!.type.name==='paragraph'&&!cell.firstChild!.content.size;
export type TableGesture={time:number;changed:boolean;root?:Transaction};
function dispatchTable(editor:Editor,tr:Transaction,gesture?:TableGesture){
  if(!gesture||!gesture.changed)closeHistory(tr);
  if(gesture){
    // Disjoint row/column edits still belong to this one pointer gesture.
    if(gesture.root)tr.setMeta('appendedTransaction',gesture.root);else gesture.root=tr;
    tr.setTime(gesture.time);gesture.changed=true;
  }
  editor.view.dispatch(tr);
}
export function canAxisAction(state:EditorState,pos:number,axis:TableAxis,index:number,action:AxisAction){
  const table=state.doc.nodeAt(pos);if(table?.type.name!=='table')return false;const map=TableMap.get(table),count=axis==='row'?map.height:map.width;
  if(index<0||index>=count)return false;
  if(action==='clearContents')return true;
  if(action==='moveBefore'||action==='moveAfter'){const to=index+(action==='moveBefore'?-1:1);return to>=0&&to<count&&move(state,pos,axis,index,to);}
  if(['insertBefore','insertAfter','duplicate'].includes(action)&&count>=(axis==='row'?100:50))return false;
  // A spanning cell is one unit. Duplicating only half of it would change its neighbours.
  if(action==='duplicate')return axisCells(table,axis,index).every(p=>{const cell=table.nodeAt(p)!;return cell.attrs.colspan===1&&cell.attrs.rowspan===1;});
  return true;
}
export function moveAxis(editor:Editor,pos:number,axis:TableAxis,from:number,to:number,gesture?:TableGesture){return move(editor.state,pos,axis,from,to,tr=>dispatchTable(editor,tr,gesture));}
export function runAxisAction(editor:Editor,pos:number,axis:TableAxis,index:number,action:AxisAction){
  if(!canAxisAction(editor.state,pos,axis,index,action))return false;
  const state=selectAxis(editor.state,pos,axis,index);if(!state)return false;
  if(action==='moveBefore'||action==='moveAfter')return moveAxis(editor,pos,axis,index,index+(action==='moveBefore'?-1:1));
  const table=state.doc.nodeAt(pos)!,positions=axisCells(table,axis,index);
  if(action==='clearContents'||action==='header'){
    const tr=state.tr,allHeader=positions.every(p=>table.nodeAt(p)!.type.name==='tableHeader');
    for(const p of positions.slice().sort((a,b)=>b-a)){const cell=table.nodeAt(p)!;if(action==='header')tr.setNodeMarkup(pos+1+p,state.schema.nodes[allHeader?'tableCell':'tableHeader'],cell.attrs);else{tr.setNodeMarkup(pos+1+p,undefined,{...cell.attrs,cellTextColor:null,cellBackground:null});tr.replaceWith(pos+2+p,pos+p+cell.nodeSize,state.schema.nodes.paragraph.create());}}
    editor.view.dispatch(closeHistory(tr));return true;
  }
  const command=action==='delete'?(axis==='row'?deleteRow:deleteColumn):axis==='row'?(action==='insertBefore'?addRowBefore:addRowAfter):(action==='insertBefore'?addColumnBefore:addColumnAfter);
  if(action==='delete'){const rect=selectedRect(state);if(axis==='row'?rect.top===0&&rect.bottom===rect.map.height:rect.left===0&&rect.right===rect.map.width){const tr=state.tr.replaceWith(pos,pos+table.nodeSize,state.schema.nodes.paragraph.create(table.attrs));tr.setSelection(TextSelection.create(tr.doc,pos+1));editor.view.dispatch(closeHistory(tr));return true;}}
  return command(state,tr=>{
    if(action==='duplicate'){
      const next=tr.doc.nodeAt(pos)!,dest=axisCells(next,axis,index+1),source=positions.map(p=>table.nodeAt(p)!);
      for(let i=dest.length-1;i>=0;i--){const cell=next.nodeAt(dest[i])!,original=source[i];if(!original)continue;const copy=original.type.create({...original.attrs,blockId:null},original.content);tr.replaceWith(pos+1+dest[i],pos+1+dest[i]+cell.nodeSize,copy);}
    }
    editor.view.dispatch(closeHistory(tr));
  });
}
export function colorAxis(editor:Editor,pos:number,axis:TableAxis,index:number,color:string|null){
  const table=editor.state.doc.nodeAt(pos);if(table?.type.name!=='table')return;const tr=editor.state.tr;for(const p of axisCells(table,axis,index)){const cell=table.nodeAt(p)!;tr.setNodeMarkup(pos+1+p,undefined,{...cell.attrs,cellBackground:color});}editor.view.dispatch(closeHistory(tr));
}
/** Resize at an edge in one undo step. Shrinking never removes nonempty cells. */
export function resizeTable(editor:Editor,pos:number,axis:TableAxis,requested:number,gesture?:TableGesture){
  let state=editor.state;const original=state.doc.nodeAt(pos);if(original?.type.name!=='table')return;
  const originalMap=TableMap.get(original),count=axis==='row'?originalMap.height:originalMap.width,target=Math.max(1,Math.min(axis==='row'?100:50,requested)),tr=state.tr;
  for(let size=count;size!==target;size+=target>count?1:-1){
    const table=state.doc.nodeAt(pos)!;if(size>target&&axisCells(table,axis,size-1).some(p=>!emptyCell(table.nodeAt(p)!)))break;
    const selected=selectAxis(state,pos,axis,size-1);if(!selected)break;
    const command=target>count?(axis==='row'?addRowAfter:addColumnAfter):(axis==='row'?deleteRow:deleteColumn);
    let changed=false;command(selected,next=>{next.steps.forEach(step=>tr.step(step));state=selected.apply(next);changed=true;});if(!changed)break;
  }
  if(tr.docChanged)dispatchTable(editor,tr,gesture);
}
