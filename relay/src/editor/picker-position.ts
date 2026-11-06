type Rect={left:number;right:number;top:number;bottom:number;width:number};
/** Keep the icon reachable; prefer its end edge, then shift before falling back. */
export function pickerPosition(anchor:Rect,width:number,height:number,viewport:{width:number;height:number},block?:Rect,blockEnd=false){
  const edge=12,w=Math.min(width,viewport.width-edge*2),end=(blockEnd&&block?block.right:anchor.right)-w;
  const left=blockEnd?end:end>=edge?end:anchor.right>=w/2+edge?edge:block?.left??edge;
  const below=viewport.height-anchor.bottom-20,above=anchor.top-20,down=below>=Math.min(height,380)||below>=above,maxHeight=Math.max(100,down?below:above);
  return {left:Math.max(edge,Math.min(left,viewport.width-w-edge)),top:Math.max(edge,down?anchor.bottom+8:anchor.top-Math.min(height,maxHeight)-8),maxHeight};
}
