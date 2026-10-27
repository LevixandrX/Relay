type Bounds = { left:number;right:number;top:number;bottom:number };

/** Prefer below the source; use the space above when the lower edge is close. */
export function commentPopoverLayout(work:Bounds,anchor:Bounds,contentHeight:number,single:boolean){
  const leftEdge=work.left+12,rightEdge=work.right-12,topEdge=work.top+12,bottomEdge=work.bottom-12;
  const width=Math.max(0,Math.min(420,rightEdge-leftEdge));
  const center=single?(anchor.left+anchor.right)/2:(work.left+work.right)/2;
  const below=Math.max(0,bottomEdge-anchor.bottom-8),above=Math.max(0,anchor.top-8-topEdge);
  const needed=Math.min(420,contentHeight),upward=below<Math.min(needed,160)&&above>below;
  const maxHeight=Math.min(420,Math.max(80,upward?above:below),Math.max(0,bottomEdge-topEdge));
  const height=Math.min(contentHeight,maxHeight);
  return {width,maxHeight,left:Math.max(leftEdge,Math.min(center-width/2,rightEdge-width)),top:Math.max(topEdge,Math.min(upward?anchor.top-8-height:anchor.bottom+8,bottomEdge-height))};
}
