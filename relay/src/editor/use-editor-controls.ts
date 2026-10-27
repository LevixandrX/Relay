import {useEffect,useState} from 'react';
import type {Editor} from '@tiptap/core';
import {editorCanvas} from './use-editor-canvas';

export function editorControlsCovered(rect:{left:number;right:number;top:number;bottom:number}){
  return Array.from(document.querySelectorAll<HTMLElement>('.editor-comment-card,.editor-comment-block-popover,.editor-comments-list')).some(card=>{
    if(getComputedStyle(card).visibility==='hidden')return false;
    const r=card.getBoundingClientRect();return r.width>0&&r.height>0&&rect.left<r.right&&rect.right>r.left&&rect.top<r.bottom&&rect.bottom>r.top;
  });
}

export function editorControlsBlocked(editor:Editor){
  if(document.documentElement.classList.contains('editor-overlay-blocked'))return true;
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menu"],[role="dialog"],[aria-modal="true"]')).some(surface=>{
    // A page can itself be hosted in a dialog; only other visible surfaces block it.
    if(surface.contains(editor.view.dom)||surface.closest('[hidden],[aria-hidden="true"]')||surface.dataset.open==='false')return false;
    const style=getComputedStyle(surface);
    return style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&surface.getClientRects().length>0;
  });
}

/** Scroll never synthesizes a hover. A fresh pointer movement reveals controls. */
export function useEditorControls(editor:Editor){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    let lastScroll=-Infinity,x=-1,y=-1;
    const suppress=()=>{lastScroll=performance.now();setVisible(false);};
    const scroll=(event:Event)=>{if(event.target===document||event.target instanceof Element&&event.target.contains(editor.view.dom))suppress();};
    const wheel=(event:WheelEvent)=>{if(event.target instanceof Node&&editorCanvas(editor).contains(event.target))suppress();};
    const typing=(event:Event)=>{if(event.target instanceof Node&&editor.view.dom.contains(event.target))setVisible(false);};
    const move=(event:PointerEvent)=>{
      if(editorControlsBlocked(editor)||editorControlsCovered({left:event.clientX,right:event.clientX+.1,top:event.clientY,bottom:event.clientY+.1})||performance.now()-lastScroll<180){setVisible(false);x=event.clientX;y=event.clientY;return;}
      if(x===event.clientX&&y===event.clientY)return;
      x=event.clientX;y=event.clientY;setVisible(true);
    };
    const overlays=new MutationObserver(()=>{if(editorControlsBlocked(editor))setVisible(false);});
    overlays.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden','hidden','data-open','aria-modal']});overlays.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    editor.view.dom.addEventListener('beforeinput',typing);editor.view.dom.addEventListener('compositionstart',typing);
    document.addEventListener('pointermove',move);document.addEventListener('wheel',wheel,{capture:true,passive:true});window.addEventListener('scroll',scroll,true);
    return()=>{overlays.disconnect();editor.view.dom.removeEventListener('beforeinput',typing);editor.view.dom.removeEventListener('compositionstart',typing);document.removeEventListener('pointermove',move);document.removeEventListener('wheel',wheel,true);window.removeEventListener('scroll',scroll,true);};
  },[editor]);
  return visible;
}
