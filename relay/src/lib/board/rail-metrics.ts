export function railMetrics(length:number,view:number,total:number,scroll:number,inset:number){
  const track=Math.max(0,length-inset*2),range=Math.max(0,total-view),size=Math.min(track,Math.max(20,view/Math.max(1,total)*track));
  return {start:inset+Math.max(0,Math.min(range,scroll))/Math.max(1,range)*(track-size),size,range,travel:track-size,show:range>2};
}
