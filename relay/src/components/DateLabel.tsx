"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'use-intl';
import { exactTime } from '../lib/display-time';
import {OverlayPresence,OverlaySurface} from '../editor/EditorOverlay';

/** Exact timestamps are available on hover and keyboard focus, without moving content. */
export function DateLabel({value,children,className,label}: {value:string;children:ReactNode;className?:string;label?:string}) {
  const locale=useLocale(),id=useId(),anchor=useRef<HTMLTimeElement>(null),tip=useRef<HTMLDivElement>(null),timer=useRef(0);
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0,visibility:'hidden' as 'hidden'|'visible'});
  const cancel=()=>window.clearTimeout(timer.current);
  const enter=()=>{cancel();timer.current=window.setTimeout(()=>setOpen(true),180);};
  const leave=()=>{cancel();timer.current=window.setTimeout(()=>setOpen(false),100);};
  useEffect(()=>{const close=()=>{cancel();setOpen(false);},key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('scroll',close,true);window.addEventListener('resize',close);window.addEventListener('keydown',key);return()=>{cancel();window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);window.removeEventListener('keydown',key);};},[]);
  useLayoutEffect(()=>{if(!open||!anchor.current||!tip.current)return;const r=anchor.current.getBoundingClientRect(),p=tip.current.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(r.left,window.innerWidth-p.width-8)),top:Math.max(8,r.bottom+p.height+8>window.innerHeight?r.top-p.height-6:r.bottom+6),visibility:'visible'});},[open,locale,value,label]);
  return <><time ref={anchor} dateTime={value} className={className} tabIndex={0} data-comment-passive aria-describedby={open?id:undefined} onPointerEnter={enter} onPointerLeave={leave} onFocus={()=>{cancel();setOpen(true);}} onBlur={leave}>{children}</time>
    <OverlayPresence visible={open}>{open?createPortal(<OverlaySurface id={id} surfaceRef={tip} className="relay-date-tooltip" role="tooltip" style={position} onPointerEnter={cancel} onPointerLeave={leave}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M6 2v4m8-4v4M3 8h14m-10 3h1m3 0h1m-5 3h1m3 0h1"/></svg><span>{label?`${label} `:''}{exactTime(value,locale)}</span></OverlaySurface>,document.body):null}</OverlayPresence></>;
}
