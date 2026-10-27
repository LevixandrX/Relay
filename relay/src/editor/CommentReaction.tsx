"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "use-intl";
import { EmojiImage } from "./EmojiPicker";
import type { CustomEmoji } from "../lib/emoji";
import type { CommentPerson } from "./comment-types";
import {OverlayPresence,OverlaySurface} from "./EditorOverlay";

export function CommentReaction({emoji,userIds,people,custom,active,disabled,onToggle}:{emoji:string;userIds:string[];people:CommentPerson[];custom:CustomEmoji[];active:boolean;disabled:boolean;onToggle:()=>void}) {
  const t=useTranslations('editorTools.comments'),locale=useLocale(),id=useId(),ref=useRef<HTMLButtonElement>(null),timer=useRef(0);
  const [open,setOpen]=useState(false);
  const popup=useRef<HTMLDivElement>(null),[popupTop,setPopupTop]=useState<number|null>(null);
  const enter=()=>{clearTimeout(timer.current);timer.current=window.setTimeout(()=>setOpen(true),180);};
  const close=()=>{clearTimeout(timer.current);setOpen(false);};
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};window.addEventListener('scroll',close,true);window.addEventListener('resize',close);window.addEventListener('keydown',escape);return()=>{clearTimeout(timer.current);window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);window.removeEventListener('keydown',escape);};},[]);
  const names=userIds.slice(0,5).map(uid=>people.find(p=>p.id===uid)?.name??t('unknownUser'));
  if(userIds.length>5)names.push(t('morePeople',{count:userIds.length-5}));
  const caption=t('reactedWith',{names:new Intl.ListFormat(locale,{style:'short',type:'conjunction'}).format(names)});
  const r=ref.current?.getBoundingClientRect(),width=Math.min(256,window.innerWidth-24);
  const left=r?Math.max(12,Math.min(r.left+r.width/2-width/2,window.innerWidth-width-12)):12;
  const top=r?Math.max(12,Math.min(r.bottom+8,window.innerHeight-138)):12;
  useLayoutEffect(()=>{if(!open||!popup.current||!ref.current)return;const rect=ref.current.getBoundingClientRect(),height=popup.current.offsetHeight;setPopupTop(Math.max(12,Math.min(rect.bottom+height+8>window.innerHeight-12?rect.top-height-8:rect.bottom+8,window.innerHeight-height-12)));},[open,caption]);
  return <><button ref={ref} type="button" aria-disabled={disabled} data-active={active} aria-label={`${caption} ${emoji}`} aria-describedby={open?id:undefined}
    onPointerEnter={enter} onPointerLeave={close} onFocus={enter} onBlur={close} onClick={()=>{if(!disabled)onToggle();}}><EmojiImage value={emoji} custom={custom}/>{userIds.length}</button>
    <OverlayPresence visible={open}>{open?createPortal(<OverlaySurface surfaceRef={popup} id={id} role="tooltip" className="editor-comment-reaction-preview" style={{left,top:popupTop??top,width}}><div className="editor-comment-reaction-preview-image"><EmojiImage value={emoji} custom={custom}/></div><p>{caption} <EmojiImage value={emoji} custom={custom}/></p></OverlaySurface>,document.body):null}</OverlayPresence></>;
}
