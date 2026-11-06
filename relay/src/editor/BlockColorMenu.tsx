"use client";
import type {ReactNode} from 'react';
import {useTranslations} from 'use-intl';
import {Check} from 'lucide-react';
import {RichPopover,type PopoverAnchor} from './RichPopover';
import {OverlayScroll} from '../lib/board/CompactRailScroll';
import {COLOR_NAMES,COLOR_VALUES} from './block-appearance';
export function BlockColorMenu({anchor,owner,onClose,onPick,text,background,footer}:{anchor:PopoverAnchor;owner:string;onClose:()=>void;onPick:(kind:'text'|'background',value:string|null)=>void;text?:string|null;background?:string|null;footer?:ReactNode}){
  const t=useTranslations('editorTools');
  return <RichPopover initialFocus="first" anchor={anchor} owner={owner} side="right" width={264} level={114} label={t('actions.color')} onClose={onClose}><OverlayScroll className="rich-color-scroll" fitContent>{(['text','background'] as const).map(kind=><section className="rich-color-section" key={kind}><h4>{t(`colors.${kind==='text'?'textHeading':'backgroundHeading'}`)}</h4>{COLOR_NAMES.map(name=>{const value=COLOR_VALUES[name],selected=(kind==='text'?text:background)===value;return <button type="button" className="rich-menu-row rich-color-row" key={name} aria-pressed={selected} onClick={()=>onPick(kind,value)}><span className="rich-color-sample" data-kind={kind} style={kind==='text'?{color:value??undefined}:{background:value?`color-mix(in srgb, ${value} 22%, transparent)`:undefined,borderColor:value??undefined}}>{kind==='text'?'A':null}</span><span>{t(`colors.${kind}`,{color:t(`colors.names.${name}`)})}</span>{selected?<Check/>:null}</button>;})}</section>)}</OverlayScroll>{footer}</RichPopover>;
}
