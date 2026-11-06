import assert from 'node:assert/strict';
import {stageGuestComments} from '../src/editor/guest-move-comments';
import {prepareBlockMove} from '../src/domain/blocks/move-content';
import {parseDoc} from '../src/domain/blocks/schema';
const values=new Map<string,string>(),previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
try{
  const sourceKey='relay-guest-comments-v1:source',targetKey='relay-guest-comments-v1:target',activityKey='relay-guest-block-activity-v1:';
  const source={threads:[{id:'thread',blockId:'blk_ownrow0001',messages:[{files:[{id:'file'}]}]},{id:'stay',blockId:'blk_stayrow001',messages:[]}],files:{file:{data:'bytes'}}};
  const raw=JSON.stringify(source);localStorage.setItem(sourceKey,raw);localStorage.setItem(activityKey+'source',JSON.stringify({blk_ownrow0001:{editedBy:'Me'}}));
  const staged=stageGuestComments('source','target',{blk_ownrow0001:'blk_destination'});
  assert.equal(localStorage.getItem(sourceKey),raw);assert.equal(JSON.parse(localStorage.getItem(targetKey)!).threads[0].blockId,'blk_destination');
  staged.rollback();assert.equal(localStorage.getItem(targetKey),null);assert.equal(localStorage.getItem(activityKey+'target'),null);
  stageGuestComments('source','target',{blk_ownrow0001:'blk_destination'}).commit();
  assert.equal(JSON.parse(localStorage.getItem(sourceKey)!).threads[0].id,'stay');assert.equal(JSON.parse(localStorage.getItem(targetKey)!).files.file.data,'bytes');assert.equal(JSON.parse(localStorage.getItem(activityKey+'target')!).blk_destination.editedBy,'Me');
  assert.equal(JSON.parse(localStorage.getItem(activityKey+'source')!).blk_ownrow0001,undefined);
  const doc=parseDoc({type:'doc',content:[{type:'orderedList',content:[{type:'listItem',content:[{type:'paragraph',attrs:{blockId:'blk_ownrow0001'},content:[{type:'text',text:'Only this row'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Keep child'}]}]}]}]}]}]});
  const destination=parseDoc({type:'doc',content:[{type:'paragraph',attrs:{blockId:'blk_ownrow0001'}}]});
  const moved=prepareBlockMove(doc,destination,'blk_ownrow0001');
  assert.equal(moved.destination.content?.at(-1)?.type,'orderedList');assert.notEqual(moved.blockIds.blk_ownrow0001,'blk_ownrow0001');assert.ok(JSON.stringify(moved.source).includes('Keep child'));assert.ok(!JSON.stringify(moved.source).includes('Only this row'));
  console.log('Guest transfer: staged rollback, comments/files/activity, ID collisions and one ordered-list row passed');
}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
