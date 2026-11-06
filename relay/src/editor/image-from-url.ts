import {webUrl} from '../domain/blocks/rich-content';
export async function imageFromUrl(value:string){
  const url=webUrl(value);if(!url)throw Error('Invalid image URL');
  const res=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(10000)}),type=res.headers.get('content-type')?.split(';')[0]??'';
  if(!res.ok||!['image/png','image/jpeg','image/webp','image/gif'].includes(type)||!res.body)throw Error('Image unavailable');
  const reader=res.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024)throw Error('Image too large');chunks.push(value);}}finally{void reader.cancel();}
  return new File(chunks,'image.'+(type.split('/')[1]||'png'),{type});
}
