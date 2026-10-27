import assert from 'node:assert/strict';
import {pageLayout} from '../src/editor/page-layout';
for(const mode of ['normal','compact','zen'] as const){
  const nav=mode==='normal'?240:mode==='compact'?56:0;
  let enteredSide=false;
  for(let viewport=700;viewport<=1920;viewport++){
    const layout=pageLayout({viewportLeft:0,viewportRight:viewport,contentLeft:nav+30,contentRight:viewport-36,mode,annotations:true});
    if(layout.side)enteredSide=true;
    if(enteredSide)assert.ok(layout.side,`Side layout regressed at ${viewport} ${mode}`);
    const trailing=layout.side?layout.gap+layout.cardWidth:56;
    assert.ok(layout.left+layout.width+trailing<=viewport-36+.01);
    assert.ok(layout.width<=720);
    if(layout.side)assert.equal(layout.width,720);
    if(layout.wide)assert.ok(layout.left-44-layout.menuWidth-8>=12);
    if(!layout.side){const full=Math.min(720,viewport-36-56-(nav+30+64));assert.equal(layout.width,full);}
  }
}
for(const viewport of [1240,1280,1360,1400]){
  const layout=pageLayout({viewportLeft:0,viewportRight:viewport,contentLeft:30,contentRight:viewport-36,mode:'zen',annotations:true});
  assert.ok(layout.side,`Comments should use available left space at ${viewport}`);
  assert.equal(layout.width,720);
  assert.ok(layout.left+layout.width+layout.gap+layout.cardWidth<=viewport-36+.01);
}
const intermediate=pageLayout({viewportLeft:0,viewportRight:1280,contentLeft:30,contentRight:1244,mode:'zen',annotations:true});
assert.ok(intermediate.side&&!intermediate.wide,'A menu may overlay text while side discussions still fit');
for(const viewport of [960,1024,1084,1097,1280,1536,1920]){
  const layout=pageLayout({viewportLeft:0,viewportRight:viewport,contentLeft:30,contentRight:viewport-36,mode:'zen',annotations:true});
  assert.ok(layout.width>=480);
}
console.log('Adaptive editor: monotonic side/indicator transition, readable measure, menu and right gutter fit');
