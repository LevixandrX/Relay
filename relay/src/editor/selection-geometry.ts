type Rect={left:number;right:number;top:number;bottom:number};
/** Only visible fragments count, even when both endpoints are offscreen. */
export function visibleSelectionBounds(rects:Rect[],clip:Rect):Rect|null{
  const visible=rects.map(r=>({left:Math.max(r.left,clip.left),right:Math.min(r.right,clip.right),top:Math.max(r.top,clip.top),bottom:Math.min(r.bottom,clip.bottom)})).filter(r=>r.right>r.left&&r.bottom>r.top);
  return visible.length?{left:Math.min(...visible.map(r=>r.left)),right:Math.max(...visible.map(r=>r.right)),top:Math.min(...visible.map(r=>r.top)),bottom:Math.max(...visible.map(r=>r.bottom))}:null;
}
