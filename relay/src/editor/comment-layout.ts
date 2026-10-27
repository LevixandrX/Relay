import {annotationSource} from './annotation-source';
export type CommentStack = { desired: number; items: { key: string; height: number }[] };
export const COMMENT_GAP = 12;

/** A bounded duration also feels quick for very long discussions. */
export function scrollCommentHistory(port: HTMLElement) {
  let frame=0;
  const stop=()=>{cancelAnimationFrame(frame);port.removeEventListener('wheel',stop);port.removeEventListener('pointerdown',stop);port.removeEventListener('keydown',stop);};
  const end=()=>Math.max(0,port.scrollHeight-port.clientHeight);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){port.scrollTop=end();return stop;}
  const from=port.scrollTop,start=performance.now();
  const step=(now:number)=>{const progress=Math.min(1,(now-start)/320);port.scrollTo({top:from+(end()-from)*(1-(1-progress)**3),behavior:'instant'});if(progress<1)frame=requestAnimationFrame(step);else stop();};
  port.addEventListener('wheel',stop,{passive:true});port.addEventListener('pointerdown',stop,{passive:true});port.addEventListener('keydown',stop);
  frame=requestAnimationFrame(step);return stop;
}

/** Keep chronological stacks disjoint, aligning the active card with its anchor. */
export function packCommentStacks(groups: CommentStack[], active: string | null) {
  const heights = groups.map((g) => g.items.reduce((sum, item) => sum + item.height + COMMENT_GAP, 0));
  const starts = groups.map((g) => g.desired);
  const pivot = groups.findIndex((g) => g.items.some((item) => item.key === active));
  if (pivot >= 0) {
    const group = groups[pivot], index = group.items.findIndex((item) => item.key === active);
    starts[pivot] -= group.items.slice(0, index).reduce((sum, item) => sum + item.height + COMMENT_GAP, 0);
    for (let i = pivot - 1; i >= 0; i--) starts[i] = Math.min(starts[i], starts[i + 1] - heights[i]);
    const shift = Math.max(0, -starts[0]);
    for (let i = 0; i <= pivot; i++) starts[i] += shift;
  }
  for (let i = pivot >= 0 ? pivot + 1 : 0; i < groups.length; i++) starts[i] = Math.max(0, starts[i], i ? starts[i - 1] + heights[i - 1] : 0);
  return groups.flatMap((group, i) => {
    let top = starts[i];
    return group.items.map((item) => { const placed = { key: item.key, top }; top += item.height + COMMENT_GAP; return placed; });
  });
}

export function commentRevealDelta(top: number, height: number, clipTop: number, clipBottom: number, margin = 12) {
  const available = clipBottom - clipTop - margin * 2;
  if (height > available || top < clipTop + margin) return top - clipTop - margin;
  return Math.max(0, top + height - clipBottom + margin);
}

/** Scroll the document port only; the discussion's own history scroll stays independent. */
export function revealCommentCard(element: HTMLElement) {
  const height = Number(element.dataset.layoutHeight) || element.offsetHeight;
  const host = annotationSource(element)??element.parentElement?.parentElement;
  const top = host ? host.getBoundingClientRect().top + parseFloat(element.style.top) : element.getBoundingClientRect().top;
  let port = annotationSource(element)??element.parentElement;
  while (port && port !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(port).overflowY) && port.scrollHeight > port.clientHeight + 1) {
      const rect = port.getBoundingClientRect();
      const delta = commentRevealDelta(top, height, Math.max(0, rect.top + port.clientTop), Math.min(window.innerHeight, rect.top + port.clientTop + port.clientHeight));
      if (Math.abs(delta) > 1) port.scrollBy({ top: delta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    port = port.parentElement;
  }
  const delta = commentRevealDelta(top, height, 0, window.innerHeight);
  if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
