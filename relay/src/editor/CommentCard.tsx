"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import { revealCommentCard, scrollCommentHistory } from "./comment-layout";
import { BlockGlyph } from "./block-preview";
import { useTranslations } from "use-intl";
import {focusCommentInput} from './comment-composer-focus';
import {revealCommentCaret} from './composer-layout';
import {annotationSource} from './annotation-source';
export function CommentCard({ id, first, active, expanded = false, latest, latestFromMe = false, hovered, left, top, width, ready, onActivate, onHover, onMeasure, children, composer }: {
  id: string; first: boolean; active: boolean; hovered: boolean; left: number; top: number; width: number; ready: boolean;
  expanded?: boolean; latest?: string; latestFromMe?: boolean;
  onActivate: () => void; onHover: (value: boolean) => void; onMeasure: () => void; children: ReactNode; composer?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null), content = useRef<HTMLDivElement>(null), previous = useRef<{ height: number; width: number } | null>(null);
  const animation = useRef<Animation | null>(null), measure = useRef(onMeasure);
  const t=useTranslations('editorTools.comments');
  const move=useRef<Animation|null>(null), previousPosition=useRef<{left:number;top:number}|null>(null);
  const history=useRef<{active:boolean;expanded:boolean;latest?:string}|null>(null),atBottom=useRef(true);
  const [showJump,setShowJump]=useState(false);
  const stopScroll=useRef<(()=>void)|null>(null);
  measure.current = onMeasure;
  // Commit document positions once; interpolate visual movement on the compositor.
  useLayoutEffect(()=>{
    const element=ref.current;if(!element||!ready)return;
    const old=previousPosition.current,translate=getComputedStyle(element).translate.split(' ').map(Number.parseFloat);
    previousPosition.current={left,top};
    if(!old||(old.left===left&&old.top===top))return;
    const dx=old.left-left+(translate[0]||0),dy=old.top-top+(translate[1]||0);
    move.current?.cancel();
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)move.current=element.animate([{translate:`${dx}px ${dy}px`},{translate:'0px 0px'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
  },[left,top,ready]);
  useLayoutEffect(()=>{
    const port=ref.current?.querySelector<HTMLElement>('.editor-comment-thread-scroll > .overlay-scroll-target');
    const old=history.current;history.current={active,expanded,latest};
    if(!port)return;
    if(active&&expanded&&(!old?.active||!old.expanded||old.latest!==latest&&(atBottom.current||latestFromMe)))port.scrollTo({top:port.scrollHeight,behavior:'instant'});
    const update=()=>{atBottom.current=port.scrollHeight-port.clientHeight-port.scrollTop<4;setShowJump(active&&expanded&&!atBottom.current);};
    update();const observer=new ResizeObserver(()=>{if(atBottom.current&&active&&expanded)port.scrollTo({top:port.scrollHeight,behavior:'instant'});update();});observer.observe(port);const body=port.firstElementChild;if(body)observer.observe(body);
    port.addEventListener('scroll',update,{passive:true});
    return()=>{observer.disconnect();port.removeEventListener('scroll',update);};
  },[active,expanded,latest,latestFromMe,first]);
  useLayoutEffect(() => {
    const element = ref.current, body = content.current;
    if (!element || !body) return;
    const update = () => {
      const style = getComputedStyle(element);
      const shelf=body.querySelector<HTMLElement>('.editor-comment-cancel-shelf');
      const shelfTarget=shelf?.dataset.open==='true'?(shelf.querySelector('button')?.getBoundingClientRect().height??32):0;
      const shelfDelta=shelf?shelfTarget-shelf.getBoundingClientRect().height:0;
      const historyPort=body.querySelector<HTMLElement>('.editor-comment-thread-scroll > .overlay-scroll-target');
      const natural=Array.from(body.children).reduce((height,child)=>{const css=getComputedStyle(child);return height+(child instanceof HTMLElement&&css.position!=='absolute'?child.getBoundingClientRect().height+parseFloat(css.marginTop)+parseFloat(css.marginBottom):0);},0)+(historyPort?Math.max(0,historyPort.scrollHeight-historyPort.clientHeight):0)+shelfDelta;
      const contentHeight=Math.min(parseFloat(getComputedStyle(body).maxHeight)||Infinity,natural);
      const next = Math.round((contentHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth))*64)/64;
      const old = previous.current;
      if (old?.height === next && old.width === body.offsetWidth) return;
      const from = animation.current?.playState === 'running' ? element.getBoundingClientRect().height : old?.height ?? next;
      animation.current?.cancel();
      element.dataset.layoutHeight = String(next);
      previous.current = {height:next,width:body.offsetWidth};
      measure.current();
      // The shelf owns its height transition; pack neighbours once at its final size.
      const shelfMoving=shelf?.getAnimations().some(item=>item.playState==='running');
      if (old && old.height !== next && !shelfMoving && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animation.current = element.animate([{height:`${from}px`},{height:`${next}px`}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
      }
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(body);
    element.addEventListener('relay:comment-resize',update);
    return () => {observer.disconnect();element.removeEventListener('relay:comment-resize',update);};
  }, [first]);
  useEffect(() => () => {animation.current?.cancel();move.current?.cancel();stopScroll.current?.();}, []);
  useLayoutEffect(()=>{
    const element=ref.current,body=content.current,composer=body?.querySelector<HTMLElement>('.editor-comment-composer');
    if(!element||!body||!composer)return;
    let previousTop=composer.offsetTop,transition:Animation|null=null;
    const observer=new ResizeObserver(()=>{
      const next=composer.offsetTop,offset=previousTop-next;previousTop=next;
      if(!offset)return;
      if(composer.querySelector('.editor-comment-cancel-shelf')?.getAnimations().some(item=>item.playState==='running')){transition?.cancel();return;}
      const current=parseFloat(getComputedStyle(composer).translate.split(' ')[1])||0;
      transition?.cancel();
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)transition=composer.animate([{translate:`0px ${offset+current}px`},{translate:'0px 0px'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
    });
    observer.observe(body);observer.observe(composer);
    return()=>{observer.disconnect();transition?.cancel();};
  },[first,active,expanded]);
  useEffect(()=>{
    const element=ref.current;if(!element)return;let frame=0;
    const reveal=(event:Event)=>{
      const input=event.target;if(!(input instanceof HTMLTextAreaElement)||document.activeElement!==input)return;
      cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
        let port=annotationSource(element)??element.parentElement;
        while(port&&port!==document.body){
          if(/auto|scroll/.test(getComputedStyle(port).overflowY)&&port.scrollHeight>port.clientHeight+1){revealCommentCaret(port,input);return;}
          port=port.parentElement;
        }
      });
    };
    element.addEventListener('relay:comment-caret',reveal);
    const observer=new ResizeObserver(()=>{const input=document.activeElement;if(input instanceof HTMLTextAreaElement&&element.contains(input))input.dispatchEvent(new Event('relay:comment-caret',{bubbles:true}));});
    const composer=element.querySelector('.editor-comment-composer');if(composer)observer.observe(composer);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener('relay:comment-caret',reveal);};
  },[]);
  useEffect(()=>{if(!active||!expanded)stopScroll.current?.();},[active,expanded]);
  useEffect(() => {
    if (!active || !ready || !ref.current) return;
    const frame = requestAnimationFrame(() => { if (ref.current) revealCommentCard(ref.current); });
    return () => cancelAnimationFrame(frame);
  }, [active, ready]);
  const activate = () => {
    onActivate();
    requestAnimationFrame(() => {const input=ref.current?.querySelector<HTMLTextAreaElement>('.editor-comment-composer textarea');if(input)focusCommentInput(input);});
  };
  return <section ref={ref} className="editor-comment-card" data-comment-card={id} data-draft={first} data-focused={active} data-hovered={hovered}
    tabIndex={first ? -1 : 0} data-expanded={expanded} style={{ left, top, width, visibility: ready ? "visible" : "hidden" }}
    onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)}
    onClick={(e) => { if (!(e.target instanceof Element) || !e.target.closest("button,a,input,textarea,[data-comment-passive]")) activate(); }}
    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); activate(); } }}
    onFocusCapture={(e) => { if (!(e.target instanceof Element) || !e.target.closest('button,a,[data-comment-passive],.editor-comment-edit')) onActivate(); }}>
    <div ref={content} className="editor-comment-card-content">
      {first ? children : <OverlayScroll className="editor-comment-thread-scroll"><div className="editor-comment-history">{children}</div></OverlayScroll>}
      {showJump ? <button type="button" className="editor-comment-latest" onClick={()=>{const port=ref.current?.querySelector<HTMLElement>('.editor-comment-thread-scroll > .overlay-scroll-target');stopScroll.current?.();if(port)stopScroll.current=scrollCommentHistory(port);}}><BlockGlyph type="down"/>{t('latestMessages')}</button> : null}
      {composer}
    </div>
  </section>;
}
