import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {and,eq,inArray,sql,desc} from 'drizzle-orm';
import {db} from '@/db/client';
import {pages,pageAssets,pageRevisions,commentThreads,blockActivity} from '@/db/schema';
import {ApiError} from '@/lib/errors';
import {resourcePage} from './resources';
import {parseDoc,docToPlainText} from './schema';
import {prepareBlockMove,referencedAssets} from './move-content';
import {MAX_PAGE_ASSET_BYTES} from './rich-content';
export async function movePageBlock(userId:string,sourceId:string,input:{targetPageId:string;blockId:string;content:unknown}){
  if(!input.targetPageId||input.targetPageId===sourceId||!/^blk_[\w-]{8,80}$/.test(input.blockId))throw new ApiError(400,'validation_error','Invalid move');
  const source=await resourcePage(userId,sourceId,true),target=await resourcePage(userId,input.targetPageId,true);
  if(source.workspaceId!==target.workspaceId)throw new ApiError(400,'validation_error','Pages must belong to the same workspace');
  const current=parseDoc(input.content),saved=parseDoc(JSON.parse(source.content));
  if(!isDeepStrictEqual(current,saved))throw new ApiError(409,'conflict','Wait for the document to finish saving');
  const prepare=()=>{try{return prepareBlockMove(current,parseDoc(JSON.parse(target.content)),input.blockId);}catch(error){if(error instanceof Error&&error.message==='Block not found')throw new ApiError(404,'not_found','Block not found');throw error;}};
  const prepared=prepare(),assetIds=referencedAssets(prepared.moving),assetMap:Record<string,string>={};
  const bytes=assetIds.length?await db.select().from(pageAssets).where(and(eq(pageAssets.pageId,sourceId),inArray(pageAssets.id,assetIds))):[];
  if(bytes.length!==assetIds.length)throw new ApiError(400,'invalid_file','An attachment is unavailable');
  bytes.forEach(asset=>{assetMap[asset.id]=`asset_${randomUUID()}`;});
  const result=prepareBlockMove(current,parseDoc(JSON.parse(target.content)),input.blockId,assetMap),ts=new Date(Math.max(Date.now(),Date.parse(source.updatedAt)+1,Date.parse(target.updatedAt)+1)).toISOString();
  await db.transaction(async tx=>{
    const [usage]=await tx.select({total:sql<number>`coalesce(sum(${pageAssets.size}),0)`}).from(pageAssets).where(eq(pageAssets.pageId,target.id));
    if(Number(usage.total)+bytes.reduce((sum,item)=>sum+item.size,0)>MAX_PAGE_ASSET_BYTES)throw new ApiError(413,'asset_limit','Page file limit reached');
    for(const [page,doc] of [[source,result.source],[target,result.destination]] as const){
      const updated=await tx.update(pages).set({content:JSON.stringify(doc),plainText:docToPlainText(doc),updatedAt:ts}).where(and(eq(pages.id,page.id),eq(pages.updatedAt,page.updatedAt))).returning({id:pages.id});
      if(!updated.length)throw new ApiError(409,'conflict','Page was updated elsewhere');
      await tx.insert(pageRevisions).values({id:`rev_${randomUUID()}`,pageId:page.id,workspaceId:page.workspaceId,title:page.title,content:page.content,board:page.board,createdBy:userId,createdAt:ts});
      const revisions=await tx.select({id:pageRevisions.id}).from(pageRevisions).where(eq(pageRevisions.pageId,page.id)).orderBy(desc(pageRevisions.createdAt));const excess=revisions.slice(80);
      if(excess.length)await tx.delete(pageRevisions).where(inArray(pageRevisions.id,excess.map(row=>row.id)));
    }
    for(const asset of bytes)await tx.insert(pageAssets).values({...asset,id:assetMap[asset.id],pageId:target.id,createdAt:ts,createdBy:userId});
    for(const [oldId,newId] of Object.entries(result.blockIds)){
      await tx.update(commentThreads).set({pageId:target.id,blockId:newId}).where(and(eq(commentThreads.pageId,source.id),eq(commentThreads.blockId,oldId)));
      await tx.update(blockActivity).set({pageId:target.id,blockId:newId}).where(and(eq(blockActivity.pageId,source.id),eq(blockActivity.blockId,oldId)));
    }
  });
  return{sourceContent:result.source,updatedAt:ts,targetPageId:target.id};
}
