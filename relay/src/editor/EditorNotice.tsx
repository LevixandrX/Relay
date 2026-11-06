"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,TriangleAlert} from 'lucide-react';
import {OverlayPresence,OverlaySurface} from './EditorOverlay';

type Notice={text:string;tone:'success'|'error'};
export function notifyEditor(text:string,tone:Notice['tone']='success'){window.dispatchEvent(new CustomEvent<Notice>('relay:editor-notice',{detail:{text,tone}}));}
/** Copy feedback is shared by block menus and node-view controls. */
export function EditorNotice(){
  const [notice,setNotice]=useState<Notice&{sequence:number}>({text:'',tone:'success',sequence:0}),root=useRef<HTMLDivElement>(null);
  useEffect(()=>{const show=(event:Event)=>setNotice(old=>({...((event as CustomEvent<Notice>).detail),sequence:old.sequence+1}));window.addEventListener('relay:editor-notice',show);return()=>window.removeEventListener('relay:editor-notice',show);},[]);
  useEffect(()=>{if(!notice.text)return;const timer=setTimeout(()=>setNotice(old=>({...old,text:''})),2800);return()=>clearTimeout(timer);},[notice.text,notice.sequence]);
  return <OverlayPresence visible={Boolean(notice.text)} exitDuration={300}>{notice.text?createPortal(<OverlaySurface surfaceRef={root} motionKind="notice" className="editor-tools-notice" data-tone={notice.tone} role="status">{notice.tone==='error'?<TriangleAlert aria-hidden/>:<Check aria-hidden/>}{notice.text}</OverlaySurface>,document.body):null}</OverlayPresence>;
}
