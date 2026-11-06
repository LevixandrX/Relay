import type {Node as PMNode} from '@tiptap/pm/model';
import type {Editor} from '@tiptap/core';
import {TableMap,CellSelection} from '@tiptap/pm/tables';
import {closeHistory} from '@tiptap/pm/history';
import type {TableAxis} from './table-axis';

/** Expand to whole merged units; a drag never cuts through a spanning cell. */
export function tableAxisRange(table:PMNode,axis:TableAxis,start:number,end=start+1){
  const map=TableMap.get(table),limit=axis==='row'?map.height:map.width;start=Math.max(0,start);end=Math.min(limit,end);
  let changed=true;while(changed){changed=false;for(const pos of new Set(map.map)){const r=map.findCell(pos),a=axis==='row'?r.top:r.left,b=axis==='row'?r.bottom:r.right;if(a<end&&b>start){const nextStart=Math.min(start,a),nextEnd=Math.max(end,b);if(nextStart!==start||nextEnd!==end){start=nextStart;end=nextEnd;changed=true;}}}}
  return {start,end};
}
export function reorderedTable(table:PMNode,axis:TableAxis,start:number,end:number,boundary:number){
  const map=TableMap.get(table),limit=axis==='row'?map.height:map.width;
  if(!Number.isInteger(start)||!Number.isInteger(end)||!Number.isInteger(boundary)||start<0||end>limit||start>=end)return null;
  const range=tableAxisRange(table,axis,start,end);start=range.start;end=range.end;
  boundary=Math.max(0,Math.min(limit,boundary));
  if(boundary>=start&&boundary<=end)return null;
  // Do not drop in the middle of an unrelated merged unit.
  for(const p of new Set(map.map)){const r=map.findCell(p),a=axis==='row'?r.top:r.left,b=axis==='row'?r.bottom:r.right;if(a<boundary&&b>boundary)boundary=boundary<start?a:b;}
  const order=Array.from({length:limit},(_,i)=>i),group=order.splice(start,end-start),at=boundary>start?boundary-group.length:boundary;order.splice(at,0,...group);
  const rows:PMNode[]=[];table.forEach(row=>rows.push(row));
  let result:PMNode;
  if(axis==='row')result=table.type.create(table.attrs,order.map(i=>rows[i]),table.marks);
  else{const rank=new Map(order.map((original,index)=>[original,index]));let rowOffset=0;result=table.type.create(table.attrs,rows.map(row=>{const cells:{node:PMNode;left:number}[]=[];row.forEach((cell,offset)=>cells.push({node:cell,left:map.findCell(rowOffset+1+offset).left}));rowOffset+=row.nodeSize;cells.sort((a,b)=>rank.get(a.left)!-rank.get(b.left)!);return row.type.create(row.attrs,cells.map(cell=>cell.node),row.marks);}),table.marks);}
  return {table:result,start:at,end:at+group.length};
}
export function moveTableRange(editor:Editor,pos:number,axis:TableAxis,start:number,end:number,boundary:number){
  const table=editor.state.doc.nodeAt(pos);if(table?.type.name!=='table')return false;
  const moved=reorderedTable(table,axis,start,end,boundary);if(!moved)return false;
  const tr=closeHistory(editor.state.tr.replaceWith(pos,pos+table.nodeSize,moved.table)),map=TableMap.get(moved.table);
  const first=axis==='row'?map.map[moved.start*map.width]:map.map[moved.start],last=axis==='row'?map.map[moved.end*map.width-1]:map.map[(map.height-1)*map.width+moved.end-1];
  tr.setSelection(axis==='row'?CellSelection.rowSelection(tr.doc.resolve(pos+1+first),tr.doc.resolve(pos+1+last)):CellSelection.colSelection(tr.doc.resolve(pos+1+first),tr.doc.resolve(pos+1+last)));
  editor.view.dispatch(tr);return true;
}
