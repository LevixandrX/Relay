"use client";
import {focusBlock} from "./focus-editor";
import {bindHorizontalScroll} from './horizontal-scroll';
import {stopBlockToolEvent} from './node-view-events';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import {NodeViewWrapper,NodeViewContent,ReactNodeViewRenderer,type ReactNodeViewProps} from '@tiptap/react';
import {useEffect,useRef,useState} from 'react';
import {useTranslations} from 'use-intl';
import {ChevronDown,Copy,Check,WrapText,Ellipsis} from 'lucide-react';
import {openBlockTools} from './block-tool-events';
import {codeHighlight,languageNames} from './code-languages';
import {CodeLanguagePicker} from './CodeLanguagePicker';
import {CompactRailScroll} from '../lib/board/CompactRailScroll';
import {notifyEditor} from './EditorNotice';
function CodeView({node,editor,updateAttributes,getPos}:ReactNodeViewProps){
  const t=useTranslations('editorTools.rich'),[copied,setCopied]=useState(false),[failed,setFailed]=useState(false),[language,setLanguage]=useState(false),[caption,setCaption]=useState(false);
  const surface=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(surface.current&&scrollPort.current)return bindHorizontalScroll(surface.current,scrollPort.current);},[]);
  const anchor=useRef<HTMLButtonElement>(null),captionInput=useRef<HTMLInputElement>(null),scrollPort=useRef<HTMLPreElement>(null);
  const pick=(value:string)=>{updateAttributes({language:value});setLanguage(false);focusBlock(editor,getPos());};
  const copy=()=>void navigator.clipboard.writeText(node.textContent).then(()=>{notifyEditor(t('codeCopied'));setCopied(true);setFailed(false);window.setTimeout(()=>setCopied(false),1600);},()=>{notifyEditor(t('copyFailed'),'error');setFailed(true);});
  return <NodeViewWrapper ref={surface} className="rich-code" data-wrap={Boolean(node.attrs.wrap)} data-code-toolbar-open={language||caption}>
    <div className="rich-code-toolbar" contentEditable={false} onMouseDown={e=>e.preventDefault()}>
      <button ref={anchor} type="button" data-code-language aria-label={t('language')} aria-expanded={language} disabled={!editor.isEditable} onClick={()=>setLanguage(value=>!value)}><span>{languageNames[node.attrs.language]||node.attrs.language||'Plain text'}</span><ChevronDown className="rich-code-chevron" aria-hidden/></button>
      <span className="rich-code-divider"/>
      <button type="button" aria-label={t(copied?'copied':'copyCode')} data-editor-tooltip={t(copied?'copied':'copyCode')} onClick={copy}>{copied?<Check/>:<Copy/>}</button>
      {editor.isEditable?<><button type="button" data-code-wrap data-editor-tooltip={t(node.attrs.wrap?'unwrapCode':'wrapCode')} aria-label={t(node.attrs.wrap?'unwrapCode':'wrapCode')} aria-pressed={Boolean(node.attrs.wrap)} onClick={()=>updateAttributes({wrap:!node.attrs.wrap})}><WrapText/></button>
      <button type="button" aria-label={t('more')} data-editor-tooltip={t('more')} onClick={event=>{const pos=getPos();if(typeof pos==='number')openBlockTools(editor,pos,event.currentTarget);}}><Ellipsis/></button></>:null}
    </div>
    <button type="button" data-code-caption hidden onClick={()=>{setCaption(true);requestAnimationFrame(()=>captionInput.current?.focus());}}/>
    <div className="rich-code-frame"><pre ref={scrollPort} spellCheck={false} style={{whiteSpace:node.attrs.wrap?'pre-wrap':'pre',overflowWrap:node.attrs.wrap?'anywhere':'normal'}}><NodeViewContent<'code'> as="code" style={{whiteSpace:'inherit'}}/></pre></div><div className="rich-code-scrollbar" contentEditable={false}><CompactRailScroll target={scrollPort} axis="horizontal" arrows/></div>
    {caption||node.attrs.caption?<div className="rich-code-caption" contentEditable={false}>{editor.isEditable?<input ref={captionInput} aria-label={t('caption')} placeholder={t('caption')} maxLength={1000} value={node.attrs.caption||''} onChange={e=>updateAttributes({caption:e.target.value})} onBlur={()=>setCaption(false)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter'||e.key==='Escape'){setCaption(false);focusBlock(editor,getPos());}}}/>:node.attrs.caption}</div>:null}
    {failed?<span role="alert" className="rich-tool-error">{t('copyFailed')}</span>:null}
    {language&&anchor.current?<CodeLanguagePicker anchor={anchor.current} value={node.attrs.language} onClose={()=>setLanguage(false)} onPick={pick}/>:null}
  </NodeViewWrapper>;
}
export const CodeBlock=CodeBlockLowlight.configure({lowlight:codeHighlight,defaultLanguage:'plaintext'}).extend({
  addAttributes(){return{...this.parent?.(),wrap:{default:false,parseHTML:el=>el.getAttribute('data-wrap')==='true',renderHTML:a=>({'data-wrap':String(a.wrap)})},caption:{default:'',parseHTML:el=>el.getAttribute('data-caption')||'',renderHTML:a=>({'data-caption':a.caption})}};},
  addNodeView(){return ReactNodeViewRenderer(CodeView,{attrs:({HTMLAttributes})=>HTMLAttributes,stopEvent:stopBlockToolEvent});}
});
