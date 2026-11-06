/** Shared workspace emoji image encoding, independent of picker presentation. */
export async function customEmojiImage(file:File){
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>2*1024*1024)throw Error('Invalid image');
  const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const scale=Math.min(64/bitmap.width,64/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;
  canvas.getContext('2d')!.drawImage(bitmap,(64-w)/2,(64-h)/2,w,h);bitmap.close();
  const data=canvas.toDataURL('image/png').split(',')[1];if(data.length>43692)throw Error('Invalid image');return data;
}
