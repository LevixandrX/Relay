import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {PageSaveQueue} from '../src/lib/page-save-queue';
async function worker(){
 const {db,client}=await import('../src/db/client'),s=await import('../src/db/schema');const {updatePage,getPageForUser}=await import('../src/domain/pages/repo');const {readBlockActivity}=await import('../src/domain/blocks/activity');
 const ts='2026-11-01T12:00:00.000Z',base={type:'doc' as const,content:[{type:'paragraph',attrs:{blockId:'blk_baseline-test-01'}}]};
 try{
  await db.insert(s.users).values({id:'owner',email:'owner@save.test',name:'Owner',createdAt:ts});await db.insert(s.workspaces).values({id:'ws',slug:'save-test',name:'Save test',createdBy:'owner',createdAt:ts});await db.insert(s.memberships).values({id:'member',workspaceId:'ws',userId:'owner',role:'owner',createdAt:ts});await db.insert(s.pages).values({id:'page',workspaceId:'ws',title:'Test',content:JSON.stringify(base),createdBy:'owner',createdAt:ts,updatedAt:ts});
  const table={type:'table',attrs:{blockId:'blk_table-save-01'},content:[{type:'tableRow',content:[{type:'tableCell',attrs:{colwidth:[140],cellBackground:'#cca84b'},content:[{type:'paragraph',attrs:{blockId:'blk_cell-save-01'},content:[{type:'text',text:'one'}]}]}]}]};
  const q=new PageSaveQueue();q.seed('page',ts);const one={...base,content:[...base.content,table]},two=JSON.parse(JSON.stringify(one));two.content[1].content[0].content[0].content[0].content[0].text='two';
  const responses=await Promise.all([one,two].map(content=>q.save('page','optimistic-local-time',version=>updatePage({userId:'owner',pageId:'page',baseUpdatedAt:version,content}))));
  const saved=await getPageForUser('owner','page');assert.equal(JSON.parse(saved!.page.content).content[1].content[0].content[0].content[0].content[0].text,'two');assert.equal(saved!.page.updatedAt,responses[1].updatedAt);
  const activity=await readBlockActivity('owner','page','blk_table-save-01');assert.equal(activity?.createdBy,'Owner');assert.ok(activity?.createdAt);assert.equal(activity?.editedBy,'Owner');assert.ok(activity?.editedAt);
  const third=JSON.parse(JSON.stringify(two));third.content.push({type:'paragraph',attrs:{blockId:'blk_after-table-01'},content:[{type:'text',text:'after table'}]});
  await q.save('page','ignored-local-version',version=>updatePage({userId:'owner',pageId:'page',baseUpdatedAt:version,content:third}));
  const addedActivity=await readBlockActivity('owner','page','blk_after-table-01');assert.equal(addedActivity?.createdBy,'Owner');assert.ok(addedActivity?.createdAt);
  await assert.rejects(updatePage({userId:'owner',pageId:'page',baseUpdatedAt:ts,content:one}),e=>(e as {status:number}).status===409);
  console.log('Page persistence: queued table edits survive reload, creation/edit metadata recorded, stale external writes still rejected');
 }finally{client.close();}
}
async function main(){const directory=mkdtempSync(path.join(tmpdir(),'relay-save-test-')),env={...process.env,DATABASE_URL:`file:${path.join(directory,'save.db')}`,RELAY_SAVE_WORKER:'1'};try{const migrate=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','src/db/migrate.ts'],{env,encoding:'utf8'});assert.equal(migrate.status,0,migrate.stderr);const test=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tests/page-save-persistence.ts'],{env,encoding:'utf8'});process.stdout.write(test.stdout);process.stderr.write(test.stderr);assert.equal(test.status,0);}finally{for(const f of readdirSync(directory))unlinkSync(path.join(directory,f));rmdirSync(directory);}}
void(process.env.RELAY_SAVE_WORKER?worker():main());
