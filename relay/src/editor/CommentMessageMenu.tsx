"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BlockGlyph } from "./block-preview";
import {OverlaySurface} from './EditorOverlay';

export type CommentMenuItem = {label:string;icon:string;run:()=>void;disabled?:boolean;separator?:boolean;danger?:boolean};
export function CommentMessageMenu({anchor,items,onClose,label}:{anchor:HTMLElement;items:CommentMenuItem[];onClose:()=>void;label:string}) {
  const ref=useRef<HTMLDivElement>(null), [position,setPosition]=useState({left:0,top:0,visibility:'hidden' as 'hidden'|'visible'});
  useLayoutEffect(()=>{
    const place=()=>{const menu=ref.current;if(!menu)return;const r=anchor.getBoundingClientRect(),height=menu.offsetHeight,width=menu.offsetWidth;
      setPosition({left:Math.max(12,Math.min(r.right-width,window.innerWidth-width-12)),top:Math.max(12,r.bottom+height+8>window.innerHeight-12?r.top-height-6:r.bottom+6),visibility:'visible'});};
    place();window.addEventListener('scroll',place,true);window.addEventListener('resize',place);
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
    return()=>{window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place);};
  },[anchor]);
  useEffect(()=>{const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!ref.current?.contains(e.target)&&!anchor.contains(e.target))onClose();};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[anchor,onClose]);
  return createPortal(<OverlaySurface surfaceRef={ref} blockLevel={114} className="editor-comment-more" role="menu" aria-label={label} style={position} onKeyDown={(event)=>{
    const buttons=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),index=buttons.indexOf(event.target as HTMLButtonElement);
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();anchor.focus({preventScroll:true});}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}
    if(event.key==='Tab')onClose();
  }}>{items.map((item)=><button key={item.label} type="button" role="menuitem" disabled={item.disabled} data-separator={item.separator||undefined} data-danger={item.danger||undefined} onClick={()=>{onClose();item.run();}}><BlockGlyph type={item.icon}/><span>{item.label}</span></button>)}</OverlaySurface>,document.body);
}
