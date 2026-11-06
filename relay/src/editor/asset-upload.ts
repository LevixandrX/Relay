import {MAX_ASSET_BYTES,type AssetRecord,type EditorResources} from '../domain/blocks/rich-content';
export async function uploadAsset(resources:EditorResources,file:File):Promise<Omit<AssetRecord,'data'>>{
  if(!file.size||file.size>MAX_ASSET_BYTES)throw new Error('file_limit');
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
  return resources.request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upload',name:file.name,type:file.type||'application/octet-stream',size:file.size,data})});
}
