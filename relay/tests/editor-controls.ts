import assert from 'node:assert/strict';
import {editorControlZone,editorControlBridge} from '../src/editor/editor-control-zones';
const bounds={left:100,right:820,top:50,bottom:80};
for(let x=0;x<=920;x++){
  const zone=editorControlZone(bounds,x,65,30,868);
  assert.equal(zone,x<6||x>892?null:x<640?'block':'comment');
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
