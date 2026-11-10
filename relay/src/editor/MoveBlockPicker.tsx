"use client";
import { LoadingIndicator } from "../components/LoadingIndicator";
import {useEffect,useState} from 'react';
import type {Editor} from '@tiptap/core';
import type {EditorResources,ResourcePage} from '../domain/blocks/rich-content';
import {useTranslations} from 'use-intl';
import {OverlayScroll} from '../lib/board/CompactRailScroll';
import {RichPopover} from './RichPopover';
import {BlockGlyph} from './block-preview';
import type {Doc} from '../domain/blocks/schema';
export function MoveBlockPicker({editor,resources,blockId,anchor,onClose,onMoved,owner}:{editor:Editor;resources:EditorResources;blockId:string;anchor:HTMLElement;owner:string;onClose:()=>void;onMoved:()=>void}){
  const t=useTranslations('editorTools.rich'),[pages,setPages]=useState<ResourcePage[]|null>(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let alive=true;resources.request<ResourcePage[]>('').then(result=>{if(alive)setPages(result.filter(page=>page.id!==resources.pageId));},()=>{if(alive)setError(t('loadFailed'));});return()=>{alive=false;};},[resources.pageId]);
  const move=async(id:string)=>{if(busy||!resources.moveBlock)return;const content=editor.getJSON() as Doc,editable=editor.isEditable;setBusy(true);setError('');editor.setEditable(false);try{let result:Doc|undefined;for(let attempt=0;attempt<4;attempt++){try{result=await resources.moveBlock(id,blockId,content);break;}catch(error){if(attempt===3||(error as {status?:number}).status!==409)throw error;await new Promise(resolve=>setTimeout(resolve,450));}}if(!result||editor.isDestroyed)return;const doc=editor.schema.nodeFromJSON(result);editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,doc.content).setMeta('addToHistory',false));editor.view.dom.dispatchEvent(new Event('relay:comments-changed'));onMoved();}catch{setError(t('moveFailed'));}finally{if(!editor.isDestroyed)editor.setEditable(editable);setBusy(false);}};
  return <RichPopover owner={owner} anchor={anchor} side="right" width={320} label={t('moveTo')} onClose={()=>{if(!busy)onClose();}}><input autoFocus className="rich-menu-search" aria-label={t('moveSearch')} placeholder={t('moveSearch')} disabled={busy} value={query} onChange={e=>setQuery(e.target.value)}/><OverlayScroll className="rich-format-menu-scroll" fitContent>{!pages&&!error?<LoadingIndicator />:null}{pages?.filter(page=>page.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(page=><button type="button" className="rich-menu-row" key={page.id} disabled={busy} onClick={()=>void move(page.id)}><BlockGlyph type="pageLink"/><span>{page.icon} {page.title||t('untitled')}</span></button>)}</OverlayScroll>{busy?<div className="rich-menu-empty"><LoadingIndicator label={t('moving')} inline /></div>:null}{error?<p className="rich-tool-error" role="alert">{error}</p>:null}</RichPopover>;
}
