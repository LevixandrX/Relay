// Match the document's existing per-node child limit, including pasted layouts.
export const MAX_COLUMNS = 500;
export const MIN_COLUMN_WIDTH = .01;
export const MAX_COLUMN_WIDTH = 100;
export function columnRowBounds(work:{left:number;right:number},normal:{left:number;right:number},start:number|null,end:number|null){
  const span=Math.max(1,work.right-work.left),minimum=Math.min(240,span);
  const left=start===null?normal.left:work.left+start*span;
  const right=end===null?normal.right:work.left+end*span;
  const boundedLeft=Math.max(work.left,Math.min(work.right-minimum,left));
  return {left:boundedLeft,right:Math.max(boundedLeft+minimum,Math.min(work.right,right))};
}

/** A column owns its origin; retain only indentation relative to its content. */
export function columnIndentBase(indents:number[]){
  return indents.length?Math.min(...indents.map(value=>Math.max(0,Number(value)||0))):0;
}

export function resizedColumnPair(a: number, b: number, delta: number) {
  const total = a + b;
  const minimum = Math.max(MIN_COLUMN_WIDTH, total * .1, total - MAX_COLUMN_WIDTH);
  const left = Math.max(minimum, Math.min(total - minimum, a + delta));
  return [Number(left.toFixed(8)), Number((total - left).toFixed(8))] as const;
}
