"use client";
import {useLayoutEffect,type ReactNode,type RefObject} from 'react';
import type {Editor} from '@tiptap/core';
import {bindAnnotationSource} from './annotation-source';

/** Annotation positions use document coordinates and the browser's native scroll. */
export function EditorAnnotations({editor,canvasRef,children}:{editor:Editor;canvasRef:RefObject<HTMLDivElement|null>;children:ReactNode}){
  useLayoutEffect(()=>{
    let frame=0,cleanup:(()=>void)|undefined;
    const attach=()=>{const canvas=canvasRef.current,host=editor.view.dom.closest<HTMLElement>('.relay-editor');if(!canvas||!host){frame=requestAnimationFrame(attach);return;}const unbind=bindAnnotationSource(canvas,host);host.dataset.editorComments='true';let timer=0;const scrolling=(event:Event)=>{if(event.target!==document&&!(event.target instanceof Element&&event.target.contains(host)))return;if(!host.dataset.editorScrolling)host.dataset.editorScrolling='true';clearTimeout(timer);timer=window.setTimeout(()=>delete host.dataset.editorScrolling,180);};window.addEventListener('scroll',scrolling,{capture:true,passive:true});cleanup=()=>{unbind();clearTimeout(timer);window.removeEventListener('scroll',scrolling,true);delete host.dataset.editorComments;delete host.dataset.editorScrolling;};};
    attach();return()=>{cancelAnimationFrame(frame);cleanup?.();};
  },[editor,canvasRef]);
  return <div className="editor-annotations-viewport" data-native-scroll><div ref={canvasRef} className="editor-comment-layer" data-editor-annotations-canvas>{children}</div></div>;
}
