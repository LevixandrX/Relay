import { MAX_PAGE_ASSET_BYTES, type AssetRecord, type ResourcePage } from '../domain/blocks/rich-content';
import { assetUpload } from '../domain/blocks/assets';
/** Guest bytes stay in IndexedDB rather than exhausting localStorage/document limits. */
function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('relay-page-assets-v1',1);
    request.onupgradeneeded = () => { request.result.createObjectStore('assets',{keyPath:'id'}).createIndex('pageId','pageId'); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function guestResourceRequest<T>(pageId: string, pages: ResourcePage[], suffix: string, init?: RequestInit): Promise<T> {
  const assetId = new URLSearchParams(suffix.replace(/^\?/, '')).get('assetId');
  if (!assetId && init?.method !== 'POST') return pages as T;
  const db = await database();
  try {
    return await new Promise<T>((resolve,reject) => {
      const tx = db.transaction('assets', init?.method === 'POST' ? 'readwrite' : 'readonly'), store = tx.objectStore('assets');
      let result: unknown;
      tx.oncomplete = () => resolve(result as T); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('File storage failed'));
      if (assetId) {
        const read = store.get(assetId); read.onsuccess = () => { if (read.result?.pageId !== pageId) { tx.abort(); return; } result = read.result; };
      } else {
        const input = assetUpload.parse(JSON.parse(String(init?.body))), usage = store.index('pageId').getAll(pageId);
        if (atob(input.data).length !== input.size) throw new Error('Invalid file data');
        usage.onsuccess = () => {
          if ((usage.result as AssetRecord[]).reduce((n,f) => n + f.size,0) + input.size > MAX_PAGE_ASSET_BYTES) { tx.abort(); return; }
          const record = { ...input, id: `asset_${crypto.randomUUID()}`, pageId }; store.put(record);
          result = {id:record.id,name:record.name,type:record.type,size:record.size};
        };
      }
    });
  } finally { db.close(); }
}
export async function copyGuestAssets(sourceId:string,targetId:string,ids:string[]){
  if(!ids.length)return{};const db=await database();try{return await new Promise<Record<string,string>>((resolve,reject)=>{const tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets'),map:Record<string,string>={},files:Record<string,AssetRecord&{pageId:string}>={};let total:number|null=null;
    const finish=()=>{if(total===null||Object.keys(files).length!==ids.length)return;if(total+Object.values(files).reduce((sum,file)=>sum+file.size,0)>MAX_PAGE_ASSET_BYTES){tx.abort();return;}for(const id of ids){map[id]=`asset_${crypto.randomUUID()}`;store.put({...files[id],id:map[id],pageId:targetId});}};
    const usage=store.index('pageId').getAll(targetId);usage.onsuccess=()=>{total=usage.result.reduce((sum:number,file:AssetRecord)=>sum+file.size,0);finish();};
    for(const id of ids){const request=store.get(id);request.onsuccess=()=>{if(!request.result||request.result.pageId!==sourceId){tx.abort();return;}files[id]=request.result;finish();};}
    tx.oncomplete=()=>resolve(map);tx.onabort=()=>reject(new Error('Could not copy attachments'));tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
