type Point={x:number;y:number};
type Edge='row'|'column'|null;
/** A deliberate change of direction wins; pointer jitter never flips the last-cell edge. */
export function tableHoverEdge(point:Point,anchor:Point|null,lastRow:boolean,lastColumn:boolean,old:Edge):Edge{
  if(!lastRow)return lastColumn?'column':null;
  if(!lastColumn)return 'row';
  if(!anchor)return old??'row';
  const dx=Math.abs(point.x-anchor.x),dy=Math.abs(point.y-anchor.y);
  if(!old)return Math.max(dx,dy)<4?'row':dx>dy?'column':'row';
  if(old==='row'&&dx>=14&&dx>dy*1.6)return 'column';
  if(old==='column'&&dy>=14&&dy>dx*1.6)return 'row';
  return old;
}
