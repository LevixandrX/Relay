type Bounds={left:number;right:number;top:number;bottom:number};
export const CONTROL_REACH=32;
export const BLOCK_CONTROL_GAP=10;
export const BLOCK_CONTROLS_WIDTH=54;
// Keep the active row while crossing the gutter, even when a neighbouring
// column is geometrically closer or its separator lies under the pointer.
export function editorControlBridge(x:number,y:number,left:number,right:number,top:number){
  return x>=left-CONTROL_REACH&&x<=right&&y>=top+2&&y<=top+28;
}
export function editorControlZone(rect:Bounds,x:number,y:number,handleLeft:number,commentRight:number){
  if(y<rect.top-6||y>rect.bottom+6)return null;
  const split=rect.left+(rect.right-rect.left)*.75;
  if(x>=handleLeft-CONTROL_REACH&&x<split)return 'block';
  if(x>=split&&x<=commentRight+CONTROL_REACH)return 'comment';
  return null;
}
/** A narrow indented row wins its gutter even inside a larger ancestor box. */
export function editorHoverRow<T extends {rect:Bounds;handleLeft:number;commentRight?:number}>(rows:T[],x:number,y:number,zone:'block'|'comment'='block'):T|null{
  let best:T|null=null,score=Infinity;
  for(const row of rows){if(editorControlZone(row.rect,x,y,row.handleLeft,row.commentRight??row.rect.right+80)!==zone)continue;const vertical=Math.max(row.rect.top-y,y-row.rect.bottom,0),height=row.rect.bottom-row.rect.top,next=vertical*10000+height+Math.max(0,row.rect.left-x)*.001;if(next<score){score=next;best=row;}}
  return best;
}
