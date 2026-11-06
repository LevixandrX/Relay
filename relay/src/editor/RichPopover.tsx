"use client";
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {OverlayScroll} from '../lib/board/CompactRailScroll';
import {OverlaySurface,isTopEditorOverlay} from './EditorOverlay';

export type PopoverAnchor={getBoundingClientRect:()=>DOMRect;contains?:(node:Node|null)=>boolean;focus?:()=>void;isConnected?:boolean};
/** Stable geometry also supports grips that disappear while a menu owns focus. */
export function RichPopover({anchor,onClose,children,label,width=280,side='bottom',align='end',owner,level=112,className='',scrollContent=false,initialFocus='field',dismissOnPointerLeave=true}:{anchor:PopoverAnchor;onClose:()=>void;children:ReactNode;label:string;width?:number;side?:'bottom'|'right';align?:'start'|'end';owner?:string;level?:number;className?:string;scrollContent?:boolean;initialFocus?:'field'|'first'|'none'|'container';dismissOnPointerLeave?:boolean}){
  const root=useRef<HTMLDivElement>(null),close=useRef(onClose),lastRect=useRef<DOMRect|null>(null);
  close.current=onClose;
  const [position,setPosition]=useState<{left:number;top:number;maxHeight:number}|null>(null);
  useLayoutEffect(()=>{
    const place=()=>{
      const live=anchor.isConnected===false?null:anchor.getBoundingClientRect();
      if(live&&(live.width||live.height))lastRect.current=live;
      const r=lastRect.current;if(!r)return;
      const h=root.current?.offsetHeight??320,w=Math.min(width,innerWidth-24),below=Math.max(80,innerHeight-r.bottom-20),above=Math.max(80,r.top-20),down=below>=Math.min(h,220)||below>=above,maxHeight=side==='right'?innerHeight-24:down?below:above;
      const left=side==='right'?(r.right+w+8<innerWidth-12?r.right+8:r.left-w-8):align==='start'&&r.left+w<=innerWidth-12?r.left:r.right-w;
      const top=side==='right'?r.top:down?r.bottom+8:r.top-Math.min(h,maxHeight)-8;
      const next={left:Math.max(12,Math.min(left,innerWidth-w-12)),top:Math.max(12,Math.min(top,innerHeight-Math.min(h,maxHeight)-12)),maxHeight};
      setPosition(old=>old&&Math.abs(old.left-next.left)<.25&&Math.abs(old.top-next.top)<.25&&Math.abs(old.maxHeight-next.maxHeight)<.25?old:next);
    };
    place();const observer=new ResizeObserver(place);if(root.current)observer.observe(root.current);
    const childSurface=(target:Element)=>{const surface=target.closest<HTMLElement>('[data-editor-overlay-surface]');return Boolean(owner&&target.closest('[data-editor-menu-owner]')?.getAttribute('data-editor-menu-owner')===owner&&(Number(surface?.dataset.editorOverlayLevel)>level||target.closest('.color-pop,.editor-comment-profile')));};
    let dismissTimer=0;
    const cancelDismiss=()=>{clearTimeout(dismissTimer);dismissTimer=0;};
    const dismiss=()=>{const focused=document.activeElement;if(focused instanceof Node&&root.current?.contains(focused))anchor.focus?.();close.current();};
    const pointer=(e:PointerEvent)=>{if(side!=='right'||!dismissOnPointerLeave)return;const target=e.target;if(target instanceof Element&&(root.current?.contains(target)||anchor.contains?.(target)||childSurface(target))){cancelDismiss();return;}const a=anchor.getBoundingClientRect(),r=root.current?.getBoundingClientRect();const corridor=r&&e.clientX>=Math.min(a.right,r.right)-8&&e.clientX<=Math.max(a.left,r.left)+8&&e.clientY>=Math.min(a.top,r.top)-8&&e.clientY<=Math.max(a.bottom,r.bottom)+8;if(corridor){cancelDismiss();return;}if(!dismissTimer)dismissTimer=window.setTimeout(dismiss,130);};
    const outside=(e:PointerEvent)=>{if(!(e.target instanceof Node)||root.current?.contains(e.target)||anchor.contains?.(e.target))return;if(e.target instanceof Element&&childSurface(e.target))return;close.current();};
    const key=(e:KeyboardEvent)=>{if((e.key==='Escape'||e.key==='ArrowLeft'&&side==='right'&&!(e.target instanceof HTMLInputElement&&e.target.value&&e.target.selectionStart!==0))&&isTopEditorOverlay(root.current)){e.preventDefault();e.stopImmediatePropagation();close.current();anchor.focus?.();}};
    document.addEventListener('pointermove',pointer);document.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',key,true);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{cancelDismiss();document.removeEventListener('pointermove',pointer);observer.disconnect();document.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',key,true);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[anchor,width,side,align,owner,level,dismissOnPointerLeave]);
  const focused=useRef(false);
  useLayoutEffect(()=>{if(!position||focused.current||initialFocus==='none')return;focused.current=true;const input=root.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([type=file]):not([hidden]):not(:disabled),textarea:not([hidden]):not(:disabled)'),button=root.current?.querySelector<HTMLElement>('button:not(:disabled)'),selected=root.current?.querySelector<HTMLElement>('[aria-current=true],[aria-pressed=true],[aria-selected=true]'),field=initialFocus==='container'?root.current?.querySelector<HTMLElement>('[data-popover-focus]')??root.current:initialFocus==='first'?button??input:input??selected??button;field?.focus({preventScroll:true});if(field){const port=field.closest<HTMLElement>('.overlay-scroll-target');if(port){const r=field.getBoundingClientRect(),p=port.getBoundingClientRect();if(r.top<p.top)port.scrollTop+=r.top-p.top;else if(r.bottom>p.bottom)port.scrollTop+=r.bottom-p.bottom;}}},[position,initialFocus]);
  return createPortal(<OverlaySurface surfaceRef={root} tabIndex={-1} owner={owner} data-editor-menu-owner={owner} blockLevel={level} className={`rich-popover ${className}`} role="dialog" aria-label={label} style={{left:position?.left??0,top:position?.top??0,width,maxHeight:position?.maxHeight,maxWidth:'calc(100vw - 24px)',visibility:position?'visible':'hidden'}} onKeyDown={e=>{if(e.defaultPrevented||!['ArrowUp','ArrowDown'].includes(e.key)||e.target instanceof HTMLTextAreaElement)return;const rows=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('.rich-menu-row:not(:disabled)')??[]);if(!rows.length)return;const index=rows.indexOf(e.target as HTMLButtonElement),next=index<0?0:(index+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;e.preventDefault();rows[next].focus({preventScroll:true});const port=rows[next].closest<HTMLElement>('.overlay-scroll-target');if(port){const row=rows[next];if(row.offsetTop<port.scrollTop)port.scrollTop=row.offsetTop;else if(row.offsetTop+row.offsetHeight>port.scrollTop+port.clientHeight)port.scrollTop=row.offsetTop+row.offsetHeight-port.clientHeight;}}}>{scrollContent?<OverlayScroll className="rich-form-scroll" fitContent>{children}</OverlayScroll>:children}</OverlaySurface>,document.body);
}
