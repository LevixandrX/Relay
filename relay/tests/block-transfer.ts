import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {prepareBlockMove} from '../src/domain/blocks/move-content';
import {parseDoc} from '../src/domain/blocks/schema';
async function worker(){const {db,client}=await import('../src/db/client'),s=await import('../src/db/schema'),{movePageBlock}=await import('../src/domain/blocks/move'),{readPageAsset}=await import('../src/domain/blocks/resources'),{eq}=await import('drizzle-orm');const ts=new Date().toISOString();
try{
 await db.insert(s.users).values(['owner','viewer','outside'].map(id=>({id,email:id+'@move.test',name:id,createdAt:ts})));
 await db.insert(s.workspaces).values(['ws','other'].map(id=>({id,name:id,slug:id,createdBy:'owner',createdAt:ts})));
 await db.insert(s.memberships).values([{id:'o',workspaceId:'ws',userId:'owner',role:'owner',createdAt:ts},{id:'v',workspaceId:'ws',userId:'viewer',role:'viewer',createdAt:ts},{id:'o2',workspaceId:'other',userId:'owner',role:'owner',createdAt:ts}]);
 const doc=parseDoc({type:'doc',content:[{type:'callout',attrs:{blockId:'blk_movingroot',iconAssetId:'asset_icon0001'},content:[{type:'paragraph',attrs:{blockId:'blk_movingtext'},content:[{type:'text',text:'Move me'}]},{type:'file',attrs:{blockId:'blk_movingfile',assetId:'asset_file0001'}}]},{type:'paragraph',attrs:{blockId:'blk_remaining1'},content:[{type:'text',text:'Stay'}]}]});
 await db.insert(s.pages).values(['source','target','foreign'].map(id=>({id,workspaceId:id==='foreign'?'other':'ws',title:id,content:JSON.stringify(id==='source'?doc:{type:'doc',content:[{type:'paragraph'}]}),createdBy:'owner',createdAt:ts,updatedAt:ts})));
 await db.insert(s.pageAssets).values(['asset_file0001','asset_icon0001'].map(id=>({id,pageId:'source',name:id,type:'image/png',size:5,data:'aGVsbG8=',createdBy:'owner',createdAt:ts})));
 await db.insert(s.commentThreads).values({id:'thread',pageId:'source',blockId:'blk_movingtext',quote:'Move me',createdBy:'owner',createdAt:ts,updatedAt:ts});
 const input={targetPageId:'target',blockId:'blk_movingroot',content:doc};
 for(const [user,target,status] of [['viewer','target',403],['outside','target',404],['owner','foreign',400]] as const)await assert.rejects(()=>movePageBlock(user,'source',{...input,targetPageId:target}),error=>(error as {status:number}).status===status);
 await assert.rejects(()=>movePageBlock('owner','source',{...input,content:{type:'doc',content:[{type:'paragraph'}]}}),error=>(error as {status:number}).status===409);
 const result=await movePageBlock('owner','source',input);assert.equal(result.sourceContent.content?.length,1);assert.equal(result.sourceContent.content?.[0].attrs?.blockId,'blk_remaining1');
 const [target]=await db.select().from(s.pages).where(eq(s.pages.id,'target'));const targetDoc=parseDoc(JSON.parse(target.content));const moved=targetDoc.content!.at(-1)!;assert.equal(moved.attrs?.blockId,'blk_movingroot');assert.notEqual(moved.attrs?.iconAssetId,'asset_icon0001');assert.equal((await readPageAsset('owner','target',String(moved.attrs?.iconAssetId))).data,'aGVsbG8=');assert.equal((await readPageAsset('owner','source','asset_icon0001')).data,'aGVsbG8=');
 const [thread]=await db.select().from(s.commentThreads).where(eq(s.commentThreads.id,'thread'));assert.equal(thread.pageId,'target');assert.equal(thread.blockId,'blk_movingtext');assert.equal((await db.select().from(s.pageRevisions)).length,2);
 const list=parseDoc({type:'doc',content:[{type:'bulletList',content:[{type:'listItem',attrs:{blockId:'blk_listitem01'},content:[{type:'paragraph',content:[{type:'text',text:'Keep list semantics'}]}]}]}]});const transfer=prepareBlockMove(list,{type:'doc'},'blk_listitem01');assert.equal(transfer.destination.content?.[0].type,'bulletList');assert.equal(transfer.source.content?.[0].type,'paragraph');
 await assert.rejects(()=>movePageBlock('owner','target',{targetPageId:'source',blockId:'blk_nonexistent',content:targetDoc}),error=>(error as {status:number}).status===404);
 await db.insert(s.pageAssets).values({id:'asset_quota00001',pageId:'source',name:'Quota fixture',type:'application/octet-stream',size:200*1024*1024,data:'',createdBy:'owner',createdAt:ts});
 const before=await db.select({id:s.pages.id,content:s.pages.content}).from(s.pages);
 await assert.rejects(()=>movePageBlock('owner','target',{targetPageId:'source',blockId:'blk_movingroot',content:targetDoc}),error=>(error as {status:number}).status===413);
 assert.deepEqual(await db.select({id:s.pages.id,content:s.pages.content}).from(s.pages),before);assert.equal((await db.select().from(s.pageRevisions)).length,2);
 console.log('Block transfer: atomic quota rollback, attachments/history, comments, list structure, stale document and RBAC passed');
}finally{client.close();}}
async function main(){const dir=mkdtempSync(path.join(tmpdir(),'relay-move-test-')),env={...process.env,DATABASE_URL:`file:${path.join(dir,'move.db')}`,RELAY_MOVE_WORKER:'1'};try{const migration=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','src/db/migrate.ts'],{env,encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);const result=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tests/block-transfer.ts'],{env,encoding:'utf8'});process.stdout.write(result.stdout);process.stderr.write(result.stderr);assert.equal(result.status,0);}finally{for(const name of readdirSync(dir))unlinkSync(path.join(dir,name));rmdirSync(dir);}}
void(process.env.RELAY_MOVE_WORKER==='1'?worker():main()).catch(error=>{console.error(error);process.exitCode=1;});
