"use client";
import {useRef,useState} from 'react';
import type {ReactNodeViewProps} from '@tiptap/react';
import {useTranslations} from 'use-intl';
import {RichPopover} from './RichPopover';
import {BlockGlyph} from './block-preview';
import {openBlockTools} from './block-tool-events';
export function MediaTools({props,replace,hasSource}:{props:ReactNodeViewProps;replace:()=>void;hasSource:boolean}){
  const t=useTranslations('editorTools.rich'),[width,setWidth]=useState(false),anchor=useRef<HTMLButtonElement>(null),kind=props.node.type.name,a=props.node.attrs;
  return <div className="rich-media-tools" data-caption={Boolean(a.caption)} contentEditable={false}>
    <button type="button" title={t(hasSource?'replace':'addSource')} aria-label={t(hasSource?'replace':'addSource')} onClick={replace}><BlockGlyph type="replace"/></button>
    <input aria-label={t('caption')} placeholder={t('caption')} maxLength={1000} value={a.caption??''} onChange={e=>props.updateAttributes({caption:e.target.value})}/>
    {['image','video','embed','pdf'].includes(kind)?<button type="button" ref={anchor} aria-label={t('width')} aria-expanded={width} onClick={()=>setWidth(v=>!v)}>{a.width??100}%</button>:null}
    <button type="button" aria-label={t('more')} title={t('more')} onClick={event=>{const pos=props.getPos();if(typeof pos==='number')openBlockTools(props.editor,pos,event.currentTarget);}}><BlockGlyph type="more"/></button>
    {width&&anchor.current?<RichPopover scrollContent anchor={anchor.current} width={180} label={t('width')} onClose={()=>setWidth(false)}>{[25,50,75,100].map(value=><button type="button" className="rich-menu-row" key={value} aria-pressed={a.width===value} onClick={()=>{props.updateAttributes({width:value});setWidth(false);}}><span>{value}%</span>{a.width===value?<BlockGlyph type="resolve"/>:null}</button>)}</RichPopover>:null}
  </div>;
}
