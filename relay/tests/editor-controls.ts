import assert from 'node:assert/strict';
import {editorControlZone,editorControlBridge,editorHoverRow} from '../src/editor/editor-control-zones';
const bounds={left:100,right:820,top:50,bottom:80};
for(let x=0;x<=920;x++){
  const zone=editorControlZone(bounds,x,65,30,868);
  assert.equal(zone,x>900?null:x<640?'block':'comment');
}
assert.equal(editorControlZone(bounds,400,20,30,868),null);
assert.equal(editorControlZone(bounds,760,100,30,868),null);
// The gutter of a narrow right column overlaps the preceding column. Crossing
// it must retain the row's controls rather than retargeting the nearest text.
for(let x=330;x<=400;x++)assert.ok(editorControlBridge(x,65,330,402,51));
assert.equal(editorControlBridge(365,100,330,402,51),false);
assert.equal(editorControlBridge(450,65,330,402,51),false);
// A nested item's next line must not be captured by the previous gutter bridge.
assert.equal(editorControlBridge(365,83,330,402,51),false);
assert.equal(editorControlBridge(365,52,330,402,51),false);
console.log('Editor controls: disjoint 75/25 zones and bounded outer reach');
for(const indent of [0,24,72,120,192]){const left=100+indent,row={rect:{left,right:820,top:120,bottom:146},handleLeft:left-74};assert.equal(editorHoverRow([row],left-105,133),row);assert.equal(editorHoverRow([row],left-107,133),null);}
const parent={rect:{left:100,right:820,top:50,bottom:220},handleLeft:26},child={rect:{left:220,right:820,top:120,bottom:146},handleLeft:146};
assert.equal(editorHoverRow([parent,child],120,133),child);
assert.equal(editorHoverRow([parent,child],112,133),parent);
console.log('Indented and nested rows retain equal left reach and win over an enclosing block');
// A resized media frame still owns the ordinary page-wide comment gutter.
const media={rect:{left:280,right:640,top:260,bottom:440},handleLeft:212,commentRight:868};
assert.equal(editorHoverRow([media],866,300,'comment'),media);
assert.equal(editorHoverRow([media],902,300,'comment'),null);
