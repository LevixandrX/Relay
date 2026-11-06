export function belowTooltip(anchor:{left:number;top:number;bottom:number;width:number},size:{width:number;height:number},viewport:{width:number;height:number}){
  const half=size.width/2;
  return {left:Math.max(half+8,Math.min(viewport.width-half-8,anchor.left+anchor.width/2)),top:anchor.bottom+8+size.height<=viewport.height-12?anchor.bottom+8:Math.max(12,anchor.top-size.height-8)};
}
