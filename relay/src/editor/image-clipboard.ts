import {webUrl} from '../domain/blocks/rich-content';
export type ClipboardImage=File|string;
export function pastedImage(data:DataTransfer):ClipboardImage|null{
  return Array.from(data.files).find(file=>file.type.startsWith('image/'))??webUrl(data.getData('text/plain'));
}
/** Read only after an explicit Paste button gesture; Ctrl+V needs no read permission. */
export async function readClipboardImage():Promise<ClipboardImage>{
  const items=await navigator.clipboard.read();
  for(const item of items){const type=item.types.find(type=>type.startsWith('image/'));if(type)return new File([await item.getType(type)],'image.png',{type});}
  for(const item of items)if(item.types.includes('text/plain')){const url=webUrl(await(await item.getType('text/plain')).text());if(url)return url;}
  throw new Error('No clipboard image');
}
