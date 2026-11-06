type Rect={left:number;right:number;top:number;bottom:number};
/** The preview stays inside its table and moves along its axis only. */
export function tableDragPosition(axis:'row'|'column',table:Rect,source:{left:number;top:number;width:number;height:number},point:{x:number;y:number},offset:{x:number;y:number}){
  const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
  return {x:axis==='row'?table.left:clamp(point.x-offset.x,table.left,table.right-source.width),y:axis==='column'?table.top:clamp(point.y-offset.y,table.top,table.bottom-source.height)};
}
