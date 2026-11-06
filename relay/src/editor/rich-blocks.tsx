"use client";
import {stopBlockToolEvent} from './node-view-events';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import {RelayTableView} from './RelayTableView';
import {TablePresentation} from './table-presentation';
import { TableKit } from '@tiptap/extension-table';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';
import { MAX_ASSET_BYTES, MEDIA_TYPES, webUrl, embedUrl, type EditorResources, type ResourcePage } from '../domain/blocks/rich-content';
import {uploadAsset} from './asset-upload';
import {FileInsertion,isAssetUploading} from './file-insertion';
import { MediaContent, type MediaAttrs } from './MediaContent';
import {BlockGlyph} from './block-preview';
import {MediaTools} from './MediaTools';
export const TABLE_EXTENSION = TableKit.configure({table:{resizable:true,cellMinWidth:48,View:RelayTableView,allowTableNodeSelection:true,renderWrapper:true}});
type Options = { getResources: () => EditorResources | undefined };
function attrs(names: Record<string,unknown>) { return Object.fromEntries(Object.entries(names).map(([key,value])=>[key,{default:value,parseHTML:(element:HTMLElement)=>{
  const raw=element.getAttribute(key);if(raw===null)return value;
  if(key==='src'||key==='url')return webUrl(raw);
  if(key==='assetId')return /^asset_[\w-]{8,80}$/.test(raw)?raw:null;
  if(typeof value==='boolean')return raw==='true';
  if(typeof value==='number')return Number.isFinite(Number(raw))?Number(raw):value;
  return raw;
}}])); }
export type {EditorResources} from '../domain/blocks/rich-content';
import {Toggle,ToggleTitle,ToggleContent} from './toggle';
export {Toggle,ToggleTitle,ToggleContent} from './toggle';
function MediaView(props:ReactNodeViewProps) {
  const t=useTranslations('editorTools.rich'),kind=props.node.type.name,resources=(props.extension.options as Options).getResources(),a=props.node.attrs as MediaAttrs;
  const [editing,setEditing]=useState(!a.src&&!a.url&&!a.assetId),[url,setUrl]=useState(a.src??a.url??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
  const uploading=busy||isAssetUploading(props.editor,props.node.attrs.blockId);
  const upload=async(file:File)=>{
    if(!resources||busy)return;
    if(file.size>MAX_ASSET_BYTES){setError(t('fileLimit'));return;}
    const expected=kind==='image'?'image/':kind==='audio'?'audio/':kind==='video'?'video/':null;
    if(expected&&(!file.type.startsWith(expected)||file.type==='image/svg+xml')||kind==='pdf'&&file.type!=='application/pdf'){setError(t('wrongFile'));return;}
    setBusy(true);setError('');const version=++generation.current;
    try{
      const record=await uploadAsset(resources,file);
      if(generation.current!==version||typeof props.getPos()!=='number')return;
      props.updateAttributes({assetId:record.id,src:null,name:record.name,type:record.type,size:record.size,uploading:false,uploadError:false});setEditing(false);
    }catch{if(generation.current===version)setError(t('uploadFailed'));}finally{if(generation.current===version)setBusy(false);}
  };
  const saveUrl=()=>{const valid=kind==='embed'?embedUrl(url):webUrl(url);if(!valid){setError(t(kind==='embed'?'unsupportedEmbed':'invalidUrl'));return;}let name=new URL(valid).hostname;try{name=decodeURIComponent(new URL(valid).pathname.split('/').pop()||name);}catch{/* A URL can contain a malformed escape sequence. */}props.updateAttributes({src:valid,...(kind==='embed'?{url:null}:{}),assetId:null,name,size:0,type:''});setEditing(false);setError('');};
  const hasSource=Boolean(a.src||a.url||a.assetId);
  return <NodeViewWrapper className={`rich-media rich-${kind}`} style={{width:`${a.width??100}%`}} data-rich-media={kind} data-has-source={hasSource} data-media-editing={editing}>
    <div contentEditable={false}>
      {hasSource?<MediaContent kind={kind} attrs={a} resources={resources}/>:null}
      {editing&&props.editor.isEditable?<div className="rich-source-form" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(hasSource)setEditing(false);props.editor.commands.focus();}}}>
        <header className="rich-source-heading"><BlockGlyph type={kind}/><span><strong>{t(uploading?'uploading':kind)}</strong><small>{t('uploadHint')}</small></span></header>
        {resources&&MEDIA_TYPES.includes(kind as never)?<label className="rich-upload"><BlockGlyph type="attach"/><span>{busy?t('uploading'):t('upload')}</span><small>{t('fileLimit')}</small><input type="file" disabled={busy} accept={kind==='image'?'image/png,image/jpeg,image/gif,image/webp,image/avif':kind==='video'?'video/*':kind==='audio'?'audio/*':kind==='pdf'?'application/pdf':undefined} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/></label>:null}
        <div className="rich-url-row"><input aria-label={t('url')} placeholder="https://" value={url} disabled={busy} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();saveUrl();}}}/><button type="button" disabled={busy||!url.trim()} onClick={saveUrl}>{t('insert')}</button></div>
        {kind==='embed'?<small>{t('embedProviders')}</small>:null}
        {hasSource?<button type="button" onClick={()=>setEditing(false)}>{t('cancel')}</button>:null}
        {error||props.node.attrs.uploadError?<span role="alert">{error||t('uploadFailed')}</span>:null}
      </div>:null}
      {props.editor.isEditable&&hasSource?<MediaTools props={props} hasSource={hasSource} replace={()=>{setUrl(a.src??a.url??'');setEditing(true);}}/>:!props.editor.isEditable&&a.caption?<figcaption>{a.caption}</figcaption>:null}
    </div>
  </NodeViewWrapper>;
}
export const MediaBlocks=[...MEDIA_TYPES,'bookmark','embed'].map(kind=>Node.create<Options>({
  name:kind,group:'block',atom:true,draggable:true,
  addOptions(){return{getResources:()=>undefined};},
  addAttributes(){return attrs({src:null,...(kind==='embed'?{url:null}:{}),assetId:null,name:'',type:'',size:0,caption:'',width:100,uploading:false,uploadError:false});},
  parseHTML(){return[{tag:`figure[data-media="${kind}"]`},...(kind==='image'?[{tag:'img[src]',getAttrs:(el:HTMLElement)=>({src:webUrl(el.getAttribute('src')),caption:el.getAttribute('alt')??''})}]:[])];},
  renderHTML({HTMLAttributes}){return['figure',mergeAttributes(HTMLAttributes,{'data-media':kind})];},
  addNodeView(){return ReactNodeViewRenderer(MediaView,{attrs:({HTMLAttributes})=>HTMLAttributes,stopEvent:stopBlockToolEvent});},
}));
import {EquationView} from './EquationView';
import {InlineAppearance} from './inline-appearance';
export const Equations=['equation','inlineEquation'].map(name=>Node.create({name,group:name==='equation'?'block':'inline',inline:name!=='equation',atom:true,addAttributes(){return attrs({latex:''});},parseHTML(){return[{tag:`span[data-type="${name}"]`}];},renderHTML({HTMLAttributes}){return['span',mergeAttributes(HTMLAttributes,{'data-type':name})];},addNodeView(){return ReactNodeViewRenderer(EquationView,{attrs:({HTMLAttributes})=>HTMLAttributes,stopEvent:stopBlockToolEvent});}}));
export function headings(editor:Editor){const result:{id:string;pos:number;label:string;level:number}[]=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='heading'||node.type.name==='toggle'&&node.attrs.level>0)result.push({id:node.attrs.blockId??'',pos,label:node.type.name==='toggle'?node.firstChild!.textContent:node.textContent,level:node.attrs.level});});return result;}
function ContentsView(props:ReactNodeViewProps){
  const t=useTranslations('editorTools.rich'),[,refresh]=useState(0);
  useEffect(()=>{const update=()=>refresh(n=>n+1);props.editor.on('update',update);return()=>{props.editor.off('update',update);};},[props.editor]);
  const rows=headings(props.editor);
  return <NodeViewWrapper className="rich-contents" contentEditable={false}><nav aria-label={t('toc')}>{rows.length?rows.map(row=><button type="button" key={row.pos} style={{paddingInlineStart:(row.level-1)*18+8}} onClick={()=>{props.editor.chain().focus().setTextSelection(row.pos+1).scrollIntoView().run();}}>{row.label||t('untitled')}</button>):<span>{t('noHeadings')}</span>}</nav></NodeViewWrapper>;
}
export const TableOfContents=Node.create({name:'tableOfContents',group:'block',atom:true,parseHTML(){return[{tag:'nav[data-table-of-contents]'}];},renderHTML({HTMLAttributes}){return['nav',mergeAttributes(HTMLAttributes,{'data-table-of-contents':''})];},addNodeView(){return ReactNodeViewRenderer(ContentsView,{attrs:({HTMLAttributes})=>HTMLAttributes,stopEvent:stopBlockToolEvent});}});
function PageLinkView(props:ReactNodeViewProps){
  const t=useTranslations('editorTools.rich'),resources=(props.extension.options as Options).getResources(),[pages,setPages]=useState<ResourcePage[]>([]),[query,setQuery]=useState(''),[error,setError]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{if(props.node.attrs.pageId||!resources||props.node.attrs.createNew)return;let cancelled=false;resources.request<ResourcePage[]>('').then(p=>{if(!cancelled)setPages(p);}).catch(()=>{if(!cancelled)setError(true);});return()=>{cancelled=true;};},[resources,props.node.attrs.pageId,props.node.attrs.createNew]);
  const create=async()=>{if(!resources?.createPage||busy)return;setBusy(true);setError(false);try{const page=await resources.createPage(query.trim()||t('untitled'));if(typeof props.getPos()==='number')props.updateAttributes({pageId:page.id,title:page.title,createNew:false});}catch{setError(true);}finally{setBusy(false);}};
  return <NodeViewWrapper className="rich-page-link" contentEditable={false}>{props.node.attrs.pageId?<><button type="button" onClick={()=>resources?.openPage(props.node.attrs.pageId)}>↗ {props.node.attrs.title||t('untitled')}</button>{props.editor.isEditable?<button type="button" className="rich-page-replace" aria-label={t('replace')} onClick={()=>props.updateAttributes({pageId:'',createNew:false})}>⋯</button>:null}</>:props.editor.isEditable?<div className="rich-source-form"><input aria-label={t(props.node.attrs.createNew?'pageTitle':'findPage')} placeholder={t(props.node.attrs.createNew?'pageTitle':'findPage')} value={query} disabled={busy} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&props.node.attrs.createNew){e.preventDefault();void create();}}}/>{props.node.attrs.createNew?<><button type="button" disabled={busy} onClick={()=>void create()}>{t(busy?'loading':'createPage')}</button><button type="button" disabled={busy} onClick={()=>props.updateAttributes({createNew:false})}>{t('choosePage')}</button></>:<div className="rich-page-results">{pages.filter(p=>p.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(p=><button type="button" key={p.id} onClick={()=>props.updateAttributes({pageId:p.id,title:p.title})}>{p.icon} {p.title||t('untitled')}</button>)}</div>}{error?<span role="alert">{t('loadFailed')}</span>:null}</div>:null}</NodeViewWrapper>;
}
export const PageLink=Node.create<Options>({name:'pageLink',group:'block',atom:true,addOptions(){return{getResources:()=>undefined};},addAttributes(){return attrs({pageId:'',title:'',createNew:false});},parseHTML(){return[{tag:'div[data-page-link]'}];},renderHTML({HTMLAttributes}){return['div',mergeAttributes(HTMLAttributes,{'data-page-link':''})];},addNodeView(){return ReactNodeViewRenderer(PageLinkView,{attrs:({HTMLAttributes})=>HTMLAttributes,stopEvent:stopBlockToolEvent});}});
export function richExtensions(getResources:()=>EditorResources|undefined){return[InlineAppearance,TablePresentation,TABLE_EXTENSION,Toggle,ToggleTitle,ToggleContent,...MediaBlocks.map(extension=>extension.configure({getResources})),...Equations,TableOfContents,PageLink.configure({getResources}),FileInsertion.configure({getResources})];}
