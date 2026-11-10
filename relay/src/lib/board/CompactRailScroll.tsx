"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,type PointerEvent,type ReactNode,type RefObject} from 'react';
import {railMetrics} from './rail-metrics';
import {railDrag} from './rail-drag';
const draggingRails=new Set<HTMLElement>();
function markDrag(track:HTMLElement,active:boolean){if(active)draggingRails.add(track);else draggingRails.delete(track);track.dataset.dragging=String(active);document.documentElement.classList.toggle('rail-scroll-dragging',draggingRails.size>0);}
export function CompactRailScroll({target,itemCount=0,arrows=false,edge=false,axis='vertical'}:{target:RefObject<HTMLElement|null>;itemCount?:number;arrows?:boolean;edge?:boolean;axis?:'vertical'|'horizontal'}){
  const trackRef=useRef<HTMLDivElement>(null),thumb=useRef<HTMLDivElement>(null),frame=useRef(0),repeat=useRef<ReturnType<typeof setTimeout>|null>(null),arrowFrame=useRef(0);
  const scrollTarget=useRef<HTMLElement|null>(null);
  useLayoutEffect(()=>{scrollTarget.current=target.current;});
  const horizontal=axis==='horizontal',inset=arrows?18:0,geometry=useRef({length:0,view:0,total:0}),metrics=useRef(railMetrics(0,0,0,0,inset));
  const paint=useCallback((value?:number)=>{const el=scrollTarget.current,track=trackRef.current,t=thumb.current;if(!el||!track||!t)return;const g=geometry.current,m=railMetrics(g.length,g.view,g.total,value??(horizontal?el.scrollLeft:el.scrollTop),inset);metrics.current=m;
    const hidden=String(!m.show);if(track.dataset.hidden!==hidden)track.dataset.hidden=hidden;
    const position=horizontal?m.start+'px 0px':'0px '+m.start+'px';if(t.style.translate!==position)t.style.translate=position;
    if(horizontal){t.style.left='0px';const size=m.size+'px';if(t.style.width!==size)t.style.width=size;}else{t.style.top='0px';const size=m.size+'px';if(t.style.height!==size)t.style.height=size;}
  },[horizontal,inset]);
  const setScroll=useCallback((value:number)=>{const el=scrollTarget.current;if(!el)return;const n=Math.max(0,Math.min(metrics.current.range,value));el.scrollTo(horizontal?{left:n,behavior:'instant'}:{top:n,behavior:'instant'});paint(n);},[horizontal,paint]);
  const driver=useRef<ReturnType<typeof railDrag>|null>(null);
  useEffect(()=>{const current=railDrag(setScroll,fn=>requestAnimationFrame(fn),id=>cancelAnimationFrame(id)),track=trackRef.current;driver.current=current;return()=>{current.cancel();if(track)markDrag(track,false);driver.current=null;};},[setScroll]);
  useEffect(()=>{const el=target.current,track=trackRef.current;if(!el||!track)return;
    let dirty=true;const observed=new Set<Element>();
    const schedule=(size=false)=>{dirty ||= size;if(frame.current)return;frame.current=requestAnimationFrame(()=>{frame.current=0;if(dirty){dirty=false;geometry.current={length:horizontal?track.clientWidth:track.clientHeight,view:horizontal?el.clientWidth:el.clientHeight,total:horizontal?el.scrollWidth:el.scrollHeight};}paint();});};
    const resize=new ResizeObserver(()=>schedule(true));resize.observe(el);resize.observe(track);
    const children=()=>{for(const child of observed)if(child.parentElement!==el){resize.unobserve(child);observed.delete(child);}for(const child of el.children)if(!observed.has(child)){observed.add(child);resize.observe(child);}schedule(true);};
    const mutation=new MutationObserver(children);mutation.observe(el,{childList:true,subtree:true,characterData:true});children();
    const scrolling=()=>schedule(),wheel=(event:WheelEvent)=>{if(!horizontal||event.ctrlKey||!metrics.current.show)return;event.preventDefault();event.stopPropagation();setScroll(el.scrollLeft+(event.deltaX||event.deltaY)*(event.deltaMode===1?16:event.deltaMode===2?el.clientWidth:1));};
    el.addEventListener('scroll',scrolling,{passive:true});track.addEventListener('wheel',wheel,{passive:false});
    return()=>{cancelAnimationFrame(frame.current);frame.current=0;resize.disconnect();mutation.disconnect();el.removeEventListener('scroll',scrolling);track.removeEventListener('wheel',wheel);};
  },[target,itemCount,paint,horizontal,setScroll]);
  const stop=useCallback(()=>{if(repeat.current)clearTimeout(repeat.current);repeat.current=null;cancelAnimationFrame(arrowFrame.current);arrowFrame.current=0;},[]);
  useEffect(()=>{const track=trackRef.current;return()=>{stop();if(track)markDrag(track,false);};},[stop]);
  const point=(event:PointerEvent)=>horizontal?event.clientX:event.clientY;
  const arrow=(event:PointerEvent<HTMLButtonElement>,direction:number)=>{event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);stop();const el=target.current;if(!el)return;setScroll((horizontal?el.scrollLeft:el.scrollTop)+direction*40);repeat.current=setTimeout(()=>{let last=performance.now();const tick=(now:number)=>{const el=target.current;if(!el)return;setScroll((horizontal?el.scrollLeft:el.scrollTop)+direction*Math.min(40,now-last)*.55);last=now;arrowFrame.current=requestAnimationFrame(tick);};arrowFrame.current=requestAnimationFrame(tick);},350);};
  const finish=()=>{driver.current?.finish();const track=trackRef.current;if(track)markDrag(track,false);};
  return <div ref={trackRef} className="rail-scroll" data-axis={axis} data-hidden="true" data-arrows={arrows||undefined} data-edge={edge||undefined} aria-hidden onPointerDown={event=>{const el=target.current,track=trackRef.current,m=metrics.current;if(!el||!track||!m.show)return;event.preventDefault();event.stopPropagation();const rect=track.getBoundingClientRect(),p=point(event)-(horizontal?rect.left:rect.top),length=horizontal?track.clientWidth:track.clientHeight;if(p<inset||p>length-inset)return;let scroll=horizontal?el.scrollLeft:el.scrollTop;if(p<m.start||p>m.start+m.size){scroll=(p-inset-m.size/2)/Math.max(1,m.travel)*m.range;setScroll(scroll);}driver.current?.start(point(event),Math.max(0,Math.min(m.range,scroll)),m.range,m.travel);markDrag(track,true);track.setPointerCapture(event.pointerId);}} onPointerMove={event=>driver.current?.move(point(event))} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
    {arrows?<button type="button" className="rail-scroll-arrow" data-direction="up" tabIndex={-1} onPointerDown={event=>arrow(event,-1)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><span className="rail-scroll-arrow-glyph">&#xF090;</span></button>:null}
    <div ref={thumb} className="rail-scroll-thumb"/>
    {arrows?<button type="button" className="rail-scroll-arrow" data-direction="down" tabIndex={-1} onPointerDown={event=>arrow(event,1)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><span className="rail-scroll-arrow-glyph">&#xF08E;</span></button>:null}
  </div>;
}

export function OverlayScroll({
  ref: surfaceRef,
  children,
  className,
  contentClassName,
  arrows = false,
  edge = false,
  fitContent = false,
}: {
  ref?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  arrows?: boolean;
  edge?: boolean;
  fitContent?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const port=ref.current;
    if(!port)return;
    const observed=new Set<Element>();
    const measure=()=>{
      for(const child of observed)if(child.parentElement!==port){observer.unobserve(child);observed.delete(child);}
      for(const child of port.children)if(!observed.has(child)){observed.add(child);observer.observe(child);}
      const value=String(port.scrollHeight-port.clientHeight>2);if(port.dataset.scrollable!==value)port.dataset.scrollable=value;if(port.scrollLeft)port.scrollLeft=0;
    };
    // These are vertical rails. Trackpad drift must not pan clipped content sideways.
    const wheel=(event:WheelEvent)=>{if(event.ctrlKey||event.defaultPrevented||!event.deltaX)return;for(let node=event.target instanceof Element?event.target:null;node&&node!==port;node=node.parentElement){if(node instanceof HTMLElement&&node.scrollWidth>node.clientWidth+1&&/auto|scroll/.test(getComputedStyle(node).overflowX))return;}event.preventDefault();if(event.deltaY)port.scrollBy({top:event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?port.clientHeight:1),behavior:'instant'});};
    const observer=new ResizeObserver(measure);observer.observe(port);
    const mutation=new MutationObserver(measure);mutation.observe(port,{childList:true,subtree:true,characterData:true});
    const resetHorizontal=()=>{if(port.scrollLeft)port.scrollLeft=0;};
    port.addEventListener('scroll',resetHorizontal,{passive:true});port.addEventListener('wheel',wheel,{passive:false});measure();
    return()=>{observer.disconnect();mutation.disconnect();port.removeEventListener('scroll',resetHorizontal);port.removeEventListener('wheel',wheel);};
  },[]);
  return (
    <div ref={surfaceRef} className={["overlay-scroll", className].filter(Boolean).join(" ")} data-fit-content={fitContent||undefined}>
      <div
        ref={ref}
        className={["overlay-scroll-target", contentClassName].filter(Boolean).join(" ")}
      >
        {children}
      </div>
      <CompactRailScroll target={ref} arrows={arrows} edge={edge} />
    </div>
  );
}
