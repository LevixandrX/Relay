import assert from 'node:assert/strict';
import {commentPopoverLayout} from '../src/editor/comment-popover-layout';
const work={left:300,right:1300,top:80,bottom:800},anchor={left:420,right:680,top:160,bottom:184};
const grouped=commentPopoverLayout(work,anchor,1200,false);
assert.equal(grouped.width,420);assert.equal(grouped.left+grouped.width/2,800);
assert.equal(grouped.top,192);assert.equal(grouped.maxHeight,420);
const single=commentPopoverLayout(work,anchor,180,true);
assert.equal(single.left+single.width/2,550);assert.equal(single.top,192);
const lower=commentPopoverLayout(work,{...anchor,top:740,bottom:764},700,true);
assert.ok(lower.top+lower.maxHeight<740);
for(const right of [590,700,900]){
  const bounded=commentPopoverLayout({...work,right},anchor,900,true);
  assert.ok(bounded.left>=312);assert.ok(bounded.left+bounded.width<=right-12);
  assert.ok(bounded.top>=92);assert.ok(bounded.top+bounded.maxHeight<=788);
}
console.log('Discussion popover: compact width, workspace/range centering, below/above placement and viewport bounds passed');
