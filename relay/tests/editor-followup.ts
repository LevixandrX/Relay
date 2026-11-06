import assert from 'node:assert/strict';
import {pickerPosition} from '../src/editor/picker-position';
import {tableDragPosition} from '../src/editor/table-drag-geometry';
const viewport={width:1280,height:720},rect=(left:number,right:number,top=100,bottom=128)=>({left,right,top,bottom,width:right-left});
const icon=rect(600,628),block=rect(588,1000);
assert.equal(pickerPosition(icon,360,380,viewport,block).left,268);
assert.equal(pickerPosition(rect(250,278),360,380,viewport,rect(238,958)).left,12);
assert.equal(pickerPosition(rect(50,78),360,380,viewport,rect(38,758)).left,38);
assert.equal(pickerPosition(rect(940,968),360,380,viewport,block,true).left,640);
const above=pickerPosition(rect(600,628,650,678),360,380,viewport,block);assert.equal(above.top,262);assert.ok(above.top+380<650);
const table={left:100,right:1000,top:200,bottom:500},source={left:300,top:200,width:200,height:300},offset={x:80,y:0};
for(const point of [{x:-400,y:0},{x:600,y:1000},{x:2000,y:-500}]){const p=tableDragPosition('column',table,source,point,offset);assert.equal(p.y,200);assert.ok(p.x>=100&&p.x+200<=1000);}
const rows={left:100,top:260,width:900,height:120};
for(const point of [{x:-400,y:-20},{x:600,y:380},{x:2000,y:900}]){const p=tableDragPosition('row',table,rows,point,{x:0,y:30});assert.equal(p.x,100);assert.ok(p.y>=200&&p.y+120<=500);}
console.log('Picker end alignment/fallback/flip and grouped table drag axis/bounds passed');
