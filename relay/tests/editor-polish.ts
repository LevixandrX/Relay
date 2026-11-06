import assert from 'node:assert/strict';
import {visibleSelectionBounds} from '../src/editor/selection-geometry';
import {tableHoverEdge} from '../src/editor/table-hover-edge';
import {avoidCommentObstacles} from '../src/editor/comment-layout';
import {emojiName} from '../src/lib/emoji-names';
const clip={left:0,right:500,top:50,bottom:400};
assert.equal(visibleSelectionBounds([{left:20,right:150,top:10,bottom:40}],clip),null);
assert.deepEqual(visibleSelectionBounds([{left:20,right:150,top:40,bottom:60}],clip),{left:20,right:150,top:50,bottom:60});
assert.deepEqual(visibleSelectionBounds([{left:20,right:150,top:0,bottom:30},{left:10,right:600,top:70,bottom:100},{left:20,right:300,top:450,bottom:480}],clip),{left:10,right:500,top:70,bottom:100});
assert.equal(tableHoverEdge({x:100,y:200},{x:100,y:180},true,true,'column'),'row');
assert.equal(tableHoverEdge({x:120,y:200},{x:100,y:200},true,true,'row'),'column');
assert.equal(tableHoverEdge({x:100,y:200},{x:100,y:200},true,true,'column'),'column');
assert.equal(tableHoverEdge({x:100,y:200},null,true,false,null),'row');
const obstacles=[{top:180,bottom:350},{top:430,bottom:560}];
const cards=avoidCommentObstacles([{key:'a',top:120,height:80},{key:'b',top:220,height:90},{key:'c',top:330,height:100}],obstacles,null);
assert.deepEqual(cards.map(c=>c.top),[350,560,662]);
for(const c of cards)for(const o of obstacles)assert.ok(c.top>=o.bottom||c.top+c.height<=o.top);
const active=avoidCommentObstacles([{key:'active',top:200,height:80},{key:'b',top:220,height:90}],obstacles,'active');assert.equal(active[0].top,200);assert.equal(active[1].top,560);
assert.equal(emojiName('👌','en'),'OK hand');assert.notEqual(emojiName('👌','ru'),'👌');
console.log('Selection viewport, exclusive table edges, packed discussion obstacles and emoji labels passed');

// Micro-jitter and diagonal travel keep one edge; deliberate motion switches it.
for(const delta of [1,2,-2,4,-6,9])assert.equal(tableHoverEdge({x:100+delta,y:200-delta/2},{x:100,y:200},true,true,'row'),'row');
assert.equal(tableHoverEdge({x:140,y:235},{x:100,y:200},true,true,'column'),'column');
assert.equal(tableHoverEdge({x:102,y:220},{x:100,y:200},true,true,'column'),'row');
