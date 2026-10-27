"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { OverlayScroll } from '../lib/board/CompactRailScroll';
import { editorClipRect } from './use-block-handles';
import { editorCanvas } from './use-editor-canvas';
import { scrollCommentHistory } from './comment-layout';
import { commentPopoverLayout } from './comment-popover-layout';
import { BlockGlyph } from './block-preview';
import { useTranslations } from 'use-intl';
import {focusCommentInput} from './comment-composer-focus';
import {revealCommentCaret} from './composer-layout';
import {OverlaySurface} from './EditorOverlay';
import {commentRow} from './comment-rows';

/** A text anchor opens without touching the editor's selection or focus. */
export function CommentBlockPopover({editor,blockId,label,ownReply,textThread,focusComposer,children}: {
  editor:Editor;blockId:string;label:string;ownReply:{threadId:string;messageId:string}|null;
  textThread:{id:string;rectIndex:number}|null;focusComposer:string|null;children:ReactNode;
}) {
  const root=useRef<HTMLDivElement>(null);
  const t=useTranslations('editorTools.comments'),[showJump,setShowJump]=useState(false),stopScroll=useRef<(()=>void)|null>(null);
  useLayoutEffect(()=>{
    const element=root.current;if(!element)return;
    const port=element.querySelector<HTMLElement>('.overlay-scroll-target'),body=port?.firstElementChild;
    let frame=0;
    const place=()=>{
      const clip=editorClipRect(editor),canvas=editorCanvas(editor).getBoundingClientRect(),viewport=window.visualViewport;
      const work={left:Math.max(canvas.left,clip.left,viewport?.offsetLeft??0),right:Math.min(canvas.right,clip.right,(viewport?.offsetLeft??0)+(viewport?.width??innerWidth)),top:Math.max(clip.top,viewport?.offsetTop??0),bottom:Math.min(clip.bottom,(viewport?.offsetTop??0)+(viewport?.height??innerHeight))};
      const block=commentRow(editor,blockId).element;
      const rects=textThread?Array.from(editor.view.dom.querySelectorAll<HTMLElement>(`[data-comment-anchor-id="${CSS.escape(textThread.id)}"]`)).flatMap(item=>Array.from(item.getClientRects())):[];
      const anchor=rects[textThread?.rectIndex??0]??block?.getBoundingClientRect()??{left:work.left,right:work.right,top:work.top+24,bottom:work.top+24};
      const next=commentPopoverLayout(work,anchor,(body?.scrollHeight??0)+2,Boolean(textThread));
      element.style.width=`${next.width}px`;element.style.maxHeight=`${next.maxHeight}px`;
      element.style.left=`${next.left}px`;element.style.top=`${next.top}px`;element.style.visibility='visible';
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;place();});};
    place();const observer=new ResizeObserver(schedule);observer.observe(element);observer.observe(editor.view.dom);observer.observe(editorCanvas(editor));if(body)observer.observe(body);
    window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);};
  },[editor,blockId,textThread]);
  useLayoutEffect(()=>{
    const port=root.current?.querySelector<HTMLElement>('.overlay-scroll-target');if(!port)return;
    const body=port.firstElementChild;let atBottom=true;
    port.scrollTop=port.scrollHeight;
    const update=()=>{atBottom=port.scrollHeight-port.scrollTop-port.clientHeight<4;const writing=root.current?.querySelector('.editor-comment-composer')&&document.activeElement instanceof Element&&Boolean(document.activeElement.closest('.editor-comment-composer'));const last=root.current?.querySelectorAll('.editor-comment-message');setShowJump(!writing&&Boolean(last?.length&&last[last.length-1].getBoundingClientRect().bottom>port.getBoundingClientRect().bottom+4));};
    const observer=new ResizeObserver(()=>{const input=document.activeElement;if(input instanceof HTMLTextAreaElement&&port.contains(input))revealCommentCaret(port,input);else if(atBottom)port.scrollTop=port.scrollHeight;update();});observer.observe(port);if(body)observer.observe(body);
    update();port.addEventListener('scroll',update,{passive:true});port.addEventListener('focusin',update);port.addEventListener('focusout',update);
    return()=>{stopScroll.current?.();observer.disconnect();port.removeEventListener('scroll',update);port.removeEventListener('focusin',update);port.removeEventListener('focusout',update);};
  },[blockId,textThread?.id]);
  useLayoutEffect(()=>{
    const element=root.current,port=element?.querySelector<HTMLElement>('.overlay-scroll-target');if(!element||!port)return;
    let frame=0;
    const reveal=(composer:Element)=>{
      const input=composer.querySelector<HTMLTextAreaElement>('textarea');if(input)revealCommentCaret(port,input);
    };
    const focused=(event:Event)=>{
      const composer=event.target instanceof Element?event.target.closest('.editor-comment-composer'):null;
      if(composer){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>reveal(composer));}
    };
    element.addEventListener('focusin',focused);
    element.addEventListener('relay:comment-caret',focused);
    const resized=new ResizeObserver(()=>{
      const active=document.activeElement instanceof Element?document.activeElement.closest('.editor-comment-composer'):null;
      if(active&&element.contains(active)){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>reveal(active));}
    });
    for(const composer of element.querySelectorAll('.editor-comment-composer'))resized.observe(composer);
    if(focusComposer)frame=requestAnimationFrame(()=>{
      const composer=element.querySelector<HTMLElement>(`[data-composer-key="${CSS.escape(focusComposer)}"]`);
      const input=composer?.querySelector<HTMLTextAreaElement>('textarea');
      if(composer&&input){focusCommentInput(input);reveal(composer);}
    });
    return()=>{cancelAnimationFrame(frame);resized.disconnect();element.removeEventListener('focusin',focused);element.removeEventListener('relay:comment-caret',focused);};
  },[focusComposer,blockId,textThread?.id]);
  useLayoutEffect(()=>{
    if(!ownReply)return;
    const composer=root.current?.querySelector<HTMLElement>(`[data-thread-id="${CSS.escape(ownReply.threadId)}"] .editor-comment-composer`);
    const port=root.current?.querySelector<HTMLElement>('.overlay-scroll-target');
    if(composer&&port){const rect=composer.getBoundingClientRect(),view=port.getBoundingClientRect();port.scrollTop+=rect.bottom-view.bottom+8;}
  },[ownReply]);
  return createPortal(<OverlaySurface surfaceRef={root} className="editor-comment-block-popover" role="dialog" aria-label={label} tabIndex={-1} style={{visibility:'hidden'}}>
    <OverlayScroll className="editor-comment-popover-scroll"><div>{children}</div></OverlayScroll>
    {showJump?<button type="button" className="editor-comment-latest" onClick={()=>{const port=root.current?.querySelector<HTMLElement>('.overlay-scroll-target');stopScroll.current?.();if(port)stopScroll.current=scrollCommentHistory(port);}}><BlockGlyph type="down"/>{t('latestMessages')}</button>:null}
  </OverlaySurface>,document.body);
}
