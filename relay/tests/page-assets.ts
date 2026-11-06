import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
async function worker(){
  const {db,client}=await import('../src/db/client'),schema=await import('../src/db/schema');
  const {uploadPageAsset,readPageAsset,publicAsset,listResourcePages}=await import('../src/domain/blocks/resources');
  const {eq}=await import('drizzle-orm');const ts=new Date().toISOString();let checks=0;
  const denied=async(fn:()=>Promise<unknown>,status:number)=>{await assert.rejects(fn,e=>(e as {status:number}).status===status);checks++;};
  try{
    await db.insert(schema.users).values(['owner','viewer','outsider'].map(id=>({id,email:`${id}@asset.test`,name:id,createdAt:ts})));
    await db.insert(schema.workspaces).values({id:'ws',name:'Workspace',slug:'ws',createdBy:'owner',createdAt:ts});
    await db.insert(schema.memberships).values(['owner','viewer'].map(id=>({id,workspaceId:'ws',userId:id,role:id,createdAt:ts})));
    await db.insert(schema.pages).values(['one','two'].map(id=>({id,workspaceId:'ws',title:id,content:'{"type":"doc","content":[{"type":"paragraph"}]}',createdBy:'owner',createdAt:ts,updatedAt:ts})));
    const input={action:'upload',name:'notes.txt',type:'text/plain',size:5,data:'aGVsbG8='};
    const file=await uploadPageAsset('owner','one',input);assert.equal((file as {data?:string}).data,undefined);checks++;
    assert.equal((await readPageAsset('viewer','one',file.id)).data,input.data);checks++;
    await denied(()=>uploadPageAsset('viewer','one',input),403);await denied(()=>uploadPageAsset('outsider','one',input),404);
    await denied(()=>readPageAsset('outsider','one',file.id),404);await denied(()=>readPageAsset('owner','two',file.id),404);
    await denied(()=>uploadPageAsset('owner','one',{...input,size:6}),400);
    assert.deepEqual((await listResourcePages('owner','one')).map(p=>p.id).sort(),['one','two']);checks++;
    await denied(()=>listResourcePages('outsider','one'),404);
    await denied(()=>publicAsset('public',file.id),404);
    await db.update(schema.pages).set({publicId:'public'}).where(eq(schema.pages.id,'one'));
    await denied(()=>publicAsset('public',file.id),404);
    await db.update(schema.pages).set({content:JSON.stringify({type:'doc',content:[{type:'file',attrs:{assetId:file.id}}]})}).where(eq(schema.pages.id,'one'));
    assert.equal((await publicAsset('public',file.id)).data,input.data);checks++;
    await db.update(schema.pages).set({content:JSON.stringify({type:'doc',content:[{type:'callout',attrs:{iconAssetId:file.id},content:[{type:'paragraph'}]}]})}).where(eq(schema.pages.id,'one'));
    assert.equal((await publicAsset('public',file.id)).data,input.data);checks++;
    await db.update(schema.pages).set({content:JSON.stringify({type:'doc',content:[{type:'callout',attrs:{emoji:''},content:[{type:'paragraph'}]}]})}).where(eq(schema.pages.id,'one'));
    await denied(()=>publicAsset('public',file.id),404);
    await db.update(schema.pages).set({publicId:null}).where(eq(schema.pages.id,'one'));await denied(()=>publicAsset('public',file.id),404);
    await db.insert(schema.pageAssets).values({id:'asset_quota-test01',pageId:'one',name:'quota fixture',type:'application/octet-stream',size:200*1024*1024,data:'',createdBy:'owner',createdAt:ts});await denied(()=>uploadPageAsset('owner','one',input),413);
    console.log(`${checks} page asset checks passed: uploads, reader/writer permissions, IDOR and current publication references`);
  }finally{client.close();}
}
async function main(){
  const directory=mkdtempSync(path.join(tmpdir(),'relay-page-assets-test-')),env={...process.env,DATABASE_URL:`file:${path.join(directory,'assets.db')}`,RELAY_ASSET_WORKER:'1'};
  try{const migration=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','src/db/migrate.ts'],{env,encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);const result=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tests/page-assets.ts'],{env,encoding:'utf8'});process.stdout.write(result.stdout);process.stderr.write(result.stderr);assert.equal(result.status,0);}finally{for(const name of readdirSync(directory))unlinkSync(path.join(directory,name));rmdirSync(directory);}
}
void(process.env.RELAY_ASSET_WORKER==='1'?worker():main()).catch(error=>{console.error(error);process.exitCode=1;});
