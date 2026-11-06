/** A native-feeling drag follows the latest pointer once per display frame. */
export function railDrag(apply:(value:number)=>void,request:(fn:()=>void)=>number,cancel:(id:number)=>void){
  let origin:{point:number;scroll:number;range:number;travel:number}|null=null,pending:number|null=null,frame=0;
  const flush=()=>{frame=0;if(pending!==null){const value=pending;pending=null;apply(value);}};
  return {
    start(point:number,scroll:number,range:number,travel:number){origin={point,scroll,range,travel};},
    move(point:number){if(!origin)return;pending=Math.max(0,Math.min(origin.range,origin.scroll+(point-origin.point)/Math.max(1,origin.travel)*origin.range));if(!frame)frame=request(flush);},
    finish(){if(frame)cancel(frame);flush();origin=null;},
    cancel(){if(frame)cancel(frame);frame=0;pending=null;origin=null;}
  };
}
