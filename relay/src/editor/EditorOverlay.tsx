"use client";
import {createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject} from 'react';

const Closing=createContext(false);
const duration=180;
export const drawerExitDuration = 200;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Retain the real portal, including its shield, until its exit has finished. */
export function OverlayPresence({visible,children,exitDuration=duration}:{visible:boolean;children:ReactNode;exitDuration?:number}){
  const saved=useRef(children),[retained,setRetained]=useState(visible);
  if(visible)saved.current=children;
  useLayoutEffect(()=>{
    if(visible){setRetained(true);return;}
    const timer=window.setTimeout(()=>{saved.current=null;setRetained(false);},reduced()?0:exitDuration);
    return()=>clearTimeout(timer);
  },[visible,exitDuration]);
  if(!visible&&!retained)return null;
  return <Closing.Provider value={!visible}>{visible?children:saved.current}</Closing.Provider>;
}

type Layer={element:HTMLElement;level:number;owner?:string};
const layers=new Set<Layer>();
const placeholderOwners=new Set<HTMLElement>();
export function suppressEditorPlaceholder(element:HTMLElement){placeholderOwners.add(element);document.documentElement.classList.add('editor-placeholder-suppressed');return()=>{placeholderOwners.delete(element);if(!placeholderOwners.size)document.documentElement.classList.remove('editor-placeholder-suppressed');};}
function topLayer(){return [...layers].reverse().sort((a,b)=>b.level-a.level)[0];}
export function isTopEditorOverlay(element:HTMLElement|null){return topLayer()?.element===element;}
function owned(layer:Layer,target:Element){return layer.element.contains(target)||Boolean(layer.owner&&target.closest('[data-editor-menu-owner]')?.getAttribute('data-editor-menu-owner')===layer.owner);}
function preventBackground(event:WheelEvent|TouchEvent){
  const layer=topLayer(),target=event.target;if(!layer||!(target instanceof Element))return;
  if(!owned(layer,target)){event.preventDefault();return;}
  // Consume a wheel at the end of a menu rather than chaining it into the page.
  if(event instanceof WheelEvent){
    let element:Element|null=target;
    while(element&&element!==document.body){
      if(element instanceof HTMLElement&&/(auto|scroll)/.test(getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+1){
        if(event.deltaY<0&&element.scrollTop>0||event.deltaY>0&&element.scrollTop+element.clientHeight<element.scrollHeight-1)return;
      }
      if(element===layer.element)break;
      element=element.parentElement;
    }
    event.preventDefault();
  }
}
function preventBackgroundKey(event:KeyboardEvent){
  const layer=topLayer(),target=event.target;
  if(event.defaultPrevented||!layer||!(target instanceof Element)||![' ','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key))return;
  if(target.closest('textarea,[contenteditable=true],input[type=date],input[type=range]'))return;
  if(target.closest('input')&&!['PageUp','PageDown'].includes(event.key))return;
  if(owned(layer,target)){
    if(event.key===' '&&target.closest('button'))return;
    for(let element:Element|null=target;element&&element!==document.body;element=element.parentElement){
      if(element instanceof HTMLElement&&/auto|scroll/.test(getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+1){
        const towardStart=['ArrowUp','PageUp','Home'].includes(event.key);
        if(towardStart?element.scrollTop>0:element.scrollTop+element.clientHeight<element.scrollHeight-1)return;
      }
      if(element===layer.element)break;
    }
  }
  event.preventDefault();
}
function register(layer:Layer){
  if(!layers.size){
    document.documentElement.classList.add('editor-overlay-blocked');
    document.addEventListener('wheel',preventBackground,{capture:true,passive:false});
    document.addEventListener('touchmove',preventBackground,{capture:true,passive:false});
    document.addEventListener('keydown',preventBackgroundKey);
  }
  layers.add(layer);
  return()=>{layers.delete(layer);if(!layers.size){
    document.documentElement.classList.remove('editor-overlay-blocked');
    document.removeEventListener('wheel',preventBackground,true);document.removeEventListener('touchmove',preventBackground,true);document.removeEventListener('keydown',preventBackgroundKey);
  }};
}

/** Shared motion and optional pointer/wheel boundary for editor popup surfaces. */
export function OverlaySurface({surfaceRef,blockLevel,owner,children,style,motionKind='popup',...props}:HTMLAttributes<HTMLDivElement>&{
  surfaceRef:RefObject<HTMLDivElement|null>;blockLevel?:number;owner?:string;style?:CSSProperties;motionKind?:'popup'|'controls'|'notice'|'drawer'|'scrim';
}){
  const closing=useContext(Closing),motion=useRef<Animation|null>(null);
  const nested=useRef(Boolean(owner&&[...layers].some(layer=>layer.owner===owner)));
  useLayoutEffect(()=>{
    const element=surfaceRef.current;if(!element)return;
    const css=getComputedStyle(element),opacity=css.opacity,scale=css.scale,translate=css.translate;
    const continuing=motion.current!==null;
    motion.current?.cancel();
    if (motionKind === "drawer" || motionKind === "scrim") {
      if (reduced()) return;
      const drawer = motionKind === "drawer";
      const hidden = drawer ? { opacity: 0.68, translate: "100% 0" } : { opacity: 0 };
      const shown = drawer ? { opacity: 1, translate: "0% 0" } : { opacity: 1 };
      const current = drawer ? { opacity, translate } : { opacity };
      motion.current = element.animate(
        closing ? [current, hidden] : [continuing ? current : hidden, shown],
        {
          duration: closing ? drawerExitDuration : 285,
          easing: closing ? "cubic-bezier(.4, 0, .7, 1)" : "cubic-bezier(.2, .8, .2, 1)",
          fill: closing ? "forwards" : "none",
        },
      );
      return;
    }
    if(motionKind==='notice'){
      if(!reduced())motion.current=element.animate(closing?[{opacity,translate},{opacity:0,translate:'0px 30px'}]:[{opacity:0,translate:'0px 30px'},{opacity:1,translate:'0px 0px'}],{duration:closing?260:340,easing:'cubic-bezier(.2,.8,.2,1)',fill:closing?'forwards':'none'});
      return;
    }
    if(!reduced())motion.current=element.animate(motionKind==='controls'?(closing?[{opacity,translate},{opacity:0,translate:'0px 2px'}]:[{opacity:continuing?opacity:0,translate:continuing?translate:'0px 2px'},{opacity:1,translate:'0px 0px'}]):closing?[{opacity,scale},{opacity:0,scale:'.985'}]:[{opacity:continuing?opacity:0,scale:continuing?scale:'.985'},{opacity:1,scale:'1'}],{duration:motionKind==='controls'?220:closing?140:160,easing:'cubic-bezier(.2,.8,.2,1)',fill:closing?'forwards':'none'});
  },[closing,surfaceRef,motionKind]);
  useLayoutEffect(()=>()=>{motion.current?.cancel();motion.current=null;},[]);
  useLayoutEffect(()=>{
    const element=surfaceRef.current;if(!element||blockLevel===undefined)return;
    return register({element,level:blockLevel,owner});
  },[surfaceRef,blockLevel,owner]);
  useLayoutEffect(()=>{
    const element=surfaceRef.current;if(!element||blockLevel===undefined&&!['dialog','menu','toolbar'].includes(props.role??''))return;
    return suppressEditorPlaceholder(element);
  },[surfaceRef,blockLevel,props.role]);
  return <>
    {blockLevel!==undefined&&!nested.current?<div className="editor-overlay-shield" style={{zIndex:blockLevel-1}} aria-hidden onPointerDown={event=>event.preventDefault()}/>:null}
    <div {...props} ref={surfaceRef} data-editor-overlay-surface data-editor-overlay-level={blockLevel} data-overlay-state={closing?'closing':'open'} inert={closing||undefined} style={{...style,...(blockLevel===undefined?{}:{zIndex:blockLevel}),...(closing?{pointerEvents:'none'}:{})}}>{children}</div>
  </>;
}
