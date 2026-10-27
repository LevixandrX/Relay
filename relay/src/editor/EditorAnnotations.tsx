"use client";
import {useLayoutEffect,useRef,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import type {Editor} from '@tiptap/core';
import {editorClipRect} from './use-block-handles';
import {editorCanvas} from './use-editor-canvas';
import {bindAnnotationSource} from './annotation-source';

/** A body-level glass surface, clipped without creating another backdrop root. */
export function EditorAnnotations({editor,canvasRef,children}:{editor:Editor;canvasRef:RefObject<HTMLDivElement|null>;children:ReactNode}){
  const viewport=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const attach=()=>{
    const box=viewport.current,canvas=canvasRef.current,host=editor.view.dom.closest<HTMLElement>('.relay-editor');
    if(!box||!canvas||!host)return;
    const unbind=bindAnnotationSource(canvas,host);host.dataset.editorComments='true';let frame=0;
    const assign=(element:HTMLElement,key:string,value:string)=>{if(element.style.getPropertyValue(key)!==value)element.style.setProperty(key,value);};
    const measure=()=>{
      const rect=host.getBoundingClientRect(),clip=editorClipRect(editor);
      assign(box,'left',`${clip.left}px`);assign(box,'top',`${clip.top}px`);assign(box,'width',`${Math.max(0,clip.right-clip.left)}px`);assign(box,'height',`${Math.max(0,clip.bottom-clip.top)}px`);
      assign(canvas,'left',`${rect.left-clip.left}px`);assign(canvas,'top',`${rect.top-clip.top}px`);assign(canvas,'width',`${rect.width}px`);box.style.visibility='visible';
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;measure();});};
    const wheel=(event:WheelEvent)=>{
      if(event.defaultPrevented||event.ctrlKey||!event.deltaY)return;
      let element=event.target instanceof HTMLElement?event.target:null;
      while(element&&element!==box){
        if(/auto|scroll/.test(getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+1&&
          (event.deltaY<0?element.scrollTop>0:element.scrollTop+element.clientHeight<element.scrollHeight-1))return;
        element=element.parentElement;
      }
      let port:HTMLElement|null=host;
      while(port&&port!==document.body){
        if(/auto|scroll/.test(getComputedStyle(port).overflowY)&&port.scrollHeight>port.clientHeight+1){event.preventDefault();port.scrollTop+=event.deltaY;return;}
        port=port.parentElement;
      }
      event.preventDefault();window.scrollBy({top:event.deltaY});
    };
    const observer=new ResizeObserver(schedule);observer.observe(host);observer.observe(editorCanvas(editor));
    const appearance=new MutationObserver(schedule);appearance.observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
    window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);box.addEventListener('wheel',wheel,{passive:false});measure();
    return()=>{unbind();delete host.dataset.editorComments;cancelAnimationFrame(frame);observer.disconnect();appearance.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);box.removeEventListener('wheel',wheel);};
    };
    // EditorContent attaches the ProseMirror DOM after sibling layout effects.
    let cleanup:(()=>void)|undefined,mount=0;
    const start=()=>{cleanup=attach();if(!cleanup)mount=requestAnimationFrame(start);};start();
    return()=>{cancelAnimationFrame(mount);cleanup?.();};
  },[editor,canvasRef]);
  if(typeof document==='undefined')return null;
  return createPortal(<div ref={viewport} className="editor-annotations-viewport" style={{visibility:'hidden',left:0,top:0,width:0,height:0}}><div ref={canvasRef} className="editor-comment-layer" data-editor-annotations-canvas>{children}</div></div>,document.body);
}
