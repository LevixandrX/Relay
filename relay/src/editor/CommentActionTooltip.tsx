"use client";
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {belowTooltip} from './tooltip-position';
import {createPortal} from 'react-dom';
import {OverlayPresence,OverlaySurface} from './EditorOverlay';

export function CommentActionTooltip(){
  const id=useId(),[tip,setTip]=useState<{label:string;left:number;top:number;bottom?:number;below?:boolean}|null>(null);
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(!tip||!root.current)return;const rect=root.current.getBoundingClientRect(),half=rect.width/2;root.current.style.left=`${Math.max(half+8,Math.min(innerWidth-half-8,tip.left))}px`;if(tip.below){const pos=belowTooltip({left:tip.left,top:tip.top,bottom:tip.bottom??tip.top,width:0},rect,{width:innerWidth,height:innerHeight});root.current.style.top=pos.top+'px';}},[tip]);
  useEffect(()=>{
    let timer=0,button:HTMLElement|null=null,previous:string|null=null,nativeTitle:string|null=null;
    const hide=()=>{clearTimeout(timer);if(button){if(nativeTitle!==null)button.setAttribute('title',nativeTitle);if(previous===null)button.removeAttribute('aria-describedby');else button.setAttribute('aria-describedby',previous);}button=null;setTip(null);};
    const show=(target:EventTarget|null)=>{
      const next=target instanceof Element?target.closest<HTMLElement>('[data-editor-tooltip],button[title],button[aria-label],kbd[title],.editor-menu-shortcut[title]'):null;
      if(document.documentElement.classList.contains('editor-table-dragging')||!next||next instanceof HTMLButtonElement&&next.disabled||!next.closest('.relay-editor,.editor-block-menu,.rich-popover,.rich-selection-tools,.editor-emoji-picker,.rich-table-controls,.editor-comment-toolbar,.editor-comment-composer-tools,.editor-comment-more,.editor-add-comment-control')){hide();return;}
      if(next===button)return;hide();button=next;previous=next.getAttribute('aria-describedby');nativeTitle=next.getAttribute('title');if(nativeTitle!==null)next.removeAttribute('title');
      timer=window.setTimeout(()=>{
        if(!next.isConnected)return;
        const rect=next.getBoundingClientRect();next.setAttribute('aria-describedby',[previous,id].filter(Boolean).join(' '));
        const below=next.dataset.tooltipPlacement==='below';
        setTip({label:next.dataset.editorTooltip||nativeTitle||next.getAttribute('aria-label')||'',left:Math.max(12,Math.min(innerWidth-12,rect.left+rect.width/2)),top:below?rect.top:rect.top>=44?rect.top-8:rect.bottom+36,bottom:rect.bottom,below});
      },220);
    };
    const over=(event:PointerEvent)=>show(event.target),focus=(event:FocusEvent)=>show(event.target);
    const out=(event:PointerEvent)=>{if(button&&!(event.relatedTarget instanceof Node&&button.contains(event.relatedTarget)))hide();};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
    document.addEventListener('relay:table-drag-start',hide);document.addEventListener('pointerover',over);document.addEventListener('pointerout',out);document.addEventListener('focusin',focus);document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide,true);document.addEventListener('keydown',key);window.addEventListener('scroll',hide,true);
    return()=>{hide();document.removeEventListener('relay:table-drag-start',hide);document.removeEventListener('pointerover',over);document.removeEventListener('pointerout',out);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',hide);document.removeEventListener('pointerdown',hide,true);document.removeEventListener('keydown',key);window.removeEventListener('scroll',hide,true);};
  },[id]);
  return <OverlayPresence visible={Boolean(tip)}>{tip?createPortal(<OverlaySurface surfaceRef={root} id={id} role="tooltip" className="editor-comment-action-tooltip" data-below={tip.below||undefined} style={{left:tip.left,top:tip.top}}>{tip.label}</OverlaySurface>,document.body):null}</OverlayPresence>;
}
