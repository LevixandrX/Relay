"use client";
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Editor} from '@tiptap/core';
import {TextSelection,type SelectionBookmark,type Transaction} from '@tiptap/pm/state';
import {useTranslations} from 'use-intl';
import {OverlayPresence,OverlaySurface} from './EditorOverlay';
import {OverlayScroll} from '../lib/board/CompactRailScroll';
import {BlockGlyph} from './block-preview';
import {BLOCK_TYPES,blockAt,blockType,canChangeBlock,changeBlock,type BlockType} from './block-commands';
import {RichPopover} from './RichPopover';
import {BlockColorMenu} from './BlockColorMenu';
import {focusEditor} from './focus-editor';
import {editorClipRect} from './use-block-handles';
import {visibleSelectionBounds} from './selection-geometry';
import {openBlockTools} from './block-tool-events';
import {webUrl} from '../domain/blocks/rich-content';
import {SmilePlus} from 'lucide-react';
const types:BlockType[]=BLOCK_TYPES.filter(type=>!['page','pageLink','prompt'].includes(type));
type Page='main'|'turn'|'color'|'link';
export function TextSelectionTools({editor,visible,onComment}:{editor:Editor;visible:boolean;onComment?:(range:{from:number;to:number})=>void}){
  const owner=useId(),t=useTranslations('editorTools'),r=useTranslations('editorTools.rich'),common=useTranslations('locale');
  const root=useRef<HTMLDivElement>(null),[typeAnchor,setTypeAnchor]=useState<HTMLButtonElement|null>(null),[colorAnchor,setColorAnchor]=useState<HTMLButtonElement|null>(null);
  const colorMenuAnchor=useMemo(()=>colorAnchor?{getBoundingClientRect:()=>{const row=colorAnchor.getBoundingClientRect(),panel=colorAnchor.closest('.rich-selection-tools')?.getBoundingClientRect()??row;return new DOMRect(panel.left,row.top,panel.width,row.height);},contains:(node:Node|null)=>colorAnchor.contains(node),focus:()=>colorAnchor.focus({preventScroll:true})}:null,[colorAnchor]);
  const bookmark=useRef<SelectionBookmark|null>(null),dismissed=useRef(false),selecting=useRef(false),pageRef=useRef<Page>('main');
  const [rect,setRect]=useState<{left:number;top:number}|null>(null),[page,setPage]=useState<Page>('main'),[url,setUrl]=useState(''),[error,setError]=useState(false),[,revision]=useState(0);
  useLayoutEffect(()=>{pageRef.current=page;},[page]);
  useEffect(()=>{
    let frame=0,timer=0,ready=false;
    const owned=(target:EventTarget|null)=>target instanceof Element&&(root.current?.contains(target)||target.closest('[data-editor-menu-owner]')?.getAttribute('data-editor-menu-owner')===owner);
    const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const selection=editor.state.selection;
      if(!ready||selecting.current||dismissed.current||selection.empty||!(selection instanceof TextSelection)||editor.isActive('codeBlock')){setRect(null);return;}
      bookmark.current=selection.getBookmark();
      try{
        const from=editor.view.domAtPos(selection.from),to=editor.view.domAtPos(selection.to),range=document.createRange();range.setStart(from.node,from.offset);range.setEnd(to.node,to.offset);
        const bounds=visibleSelectionBounds(Array.from(range.getClientRects()),editorClipRect(editor));if(!bounds){setRect(null);return;}
        const height=root.current?.offsetHeight??192,width=232,top=bounds.bottom+10+height<innerHeight-12?bounds.bottom+10:Math.max(12,bounds.top-height-10);
        setRect({left:Math.max(12,Math.min((bounds.left+bounds.right)/2-width/2,innerWidth-width-12)),top});revision(n=>n+1);
      }catch{setRect(null);}
    });};
    const settle=()=>{clearTimeout(timer);timer=window.setTimeout(()=>{ready=true;measure();},110);};
    const update=({transaction}:{transaction:Transaction})=>{
      if(transaction.docChanged&&bookmark.current)bookmark.current=bookmark.current.map(transaction.mapping);
      if(transaction.selectionSet){dismissed.current=false;if(!owned(document.activeElement)){ready=false;setRect(null);if(!selecting.current)settle();}if(transaction.selection.empty)setPage('main');}measure();
    };
    const down=(event:PointerEvent)=>{if(owned(event.target))return;setPage('main');if(event.target instanceof Node&&editor.view.dom.contains(event.target)){selecting.current=true;ready=false;clearTimeout(timer);setRect(null);}else{dismissed.current=true;setRect(null);}};
    const up=()=>{if(selecting.current){selecting.current=false;settle();}};
    const key=(event:KeyboardEvent)=>{if(event.key!=='Escape'||!owned(event.target))return;event.preventDefault();event.stopPropagation();if(pageRef.current==='main'){dismissed.current=true;setRect(null);}else setPage('main');focusEditor(editor);};
    editor.on('transaction',update);window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);document.addEventListener('pointerdown',down);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);document.addEventListener('keydown',key);settle();
    return()=>{clearTimeout(timer);cancelAnimationFrame(frame);selecting.current=false;editor.off('transaction',update);window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);document.removeEventListener('keydown',key);};
  },[editor,owner]);
  useLayoutEffect(()=>{if(!rect||!root.current)return;const height=root.current.offsetHeight;if(rect.top+height>innerHeight-12)setRect({...rect,top:Math.max(12,innerHeight-height-12)});},[page,rect]);
  const restore=()=>{try{if(!bookmark.current)return false;const selection=bookmark.current.resolve(editor.state.doc);editor.view.dispatch(editor.state.tr.setSelection(selection));focusEditor(editor);return !selection.empty;}catch{return false;}};
  const format=(command:'toggleBold'|'toggleItalic'|'toggleUnderline'|'toggleStrike'|'toggleCode')=>{if(restore())editor.commands[command]();};
  const saveLink=()=>{const href=webUrl(url);if(url.trim()&&!href){setError(true);return;}if(!restore())return;if(href)editor.commands.setLink({href});else editor.commands.unsetLink();setPage('main');setError(false);};
  const target=blockAt(editor,editor.state.selection.from),kind=target?blockType(target.node,target.parentType):'text',show=visible&&Boolean(rect);
  return <OverlayPresence visible={show}>{show?createPortal(<OverlaySurface owner={owner} data-editor-menu-owner={owner} surfaceRef={root} className="rich-selection-tools" role="toolbar" aria-label={r('formatText')} style={rect!} onMouseDown={e=>{if(!(e.target instanceof HTMLInputElement))e.preventDefault();}}>
    {page==='link'?<><button type="button" className="rich-menu-row rich-menu-back" onClick={()=>setPage('main')}><BlockGlyph type="chevronRight"/>{r('link')}</button><div className="rich-format-link"><input autoFocus aria-label={r('url')} placeholder="https://" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveLink();}}}/><button type="button" className="rich-menu-row" onClick={saveLink}>{r('done')}</button>{editor.isActive('link')?<button type="button" className="rich-menu-row" onClick={()=>{if(restore())editor.commands.unsetLink();setPage('main');}}>{r('remove')}</button>:null}{error?<p role="alert">{r('invalidUrl')}</p>:null}</div></>:<>
      <button type="button" ref={setTypeAnchor} className="rich-menu-row rich-format-type" aria-expanded={page==='turn'} onClick={()=>setPage(page==='turn'?'main':'turn')}><BlockGlyph type={kind}/><span>{t(`blocks.${kind}`)}</span><BlockGlyph type="chevronRight"/></button>
      <div className="rich-format-grid">{(['bold','italic','underline','strike','code'] as const).map((name,i)=><button type="button" key={name} aria-label={r(name)} data-editor-tooltip={r(name)} aria-pressed={editor.isActive(name)} onClick={()=>format((['toggleBold','toggleItalic','toggleUnderline','toggleStrike','toggleCode'] as const)[i])}><BlockGlyph type={name}/></button>)}<button ref={setColorAnchor} type="button" className="rich-format-color-button" aria-label={t('actions.color')} data-editor-tooltip={t('actions.color')} aria-expanded={page==='color'} onClick={()=>setPage(page==='color'?'main':'color')}><svg className="rich-format-color" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 16 5-11 5 11M9 12h6"/><path className="rich-format-color-swatch" d="M6 20h12" style={{stroke:editor.getAttributes('textStyle').color||'currentColor'}}/></svg></button><button type="button" aria-label={r('link')} data-editor-tooltip={r('link')} aria-pressed={editor.isActive('link')} onClick={()=>{setUrl(editor.getAttributes('link').href||'');setError(false);setPage('link');}}><BlockGlyph type="link"/></button><button type="button" aria-label={r('equation')} data-editor-tooltip={r('equation')} onClick={()=>{if(!restore())return;const {from,to}=editor.state.selection,latex=editor.state.doc.textBetween(from,to,'\n');editor.commands.insertContentAt({from,to},{type:'inlineEquation',attrs:{latex}});}}><BlockGlyph type="equation"/></button><button type="button" aria-label={r('clearFormatting')} data-editor-tooltip={r('clearFormatting')} onClick={()=>{if(restore())editor.commands.unsetAllMarks();}}><BlockGlyph type="clear"/></button><button type="button" aria-label={r('more')} data-editor-tooltip={r('more')} onClick={event=>{if(!restore())return;const target=blockAt(editor,editor.state.selection.from);if(target){dismissed.current=true;setRect(null);openBlockTools(editor,target.pos,event.currentTarget);}}}><BlockGlyph type="more"/></button></div>
      <div className="rich-format-footer">{onComment?<button type="button" className="rich-menu-row rich-format-comment" data-editor-tooltip={t('actions.comment')+' · Ctrl+Shift+M'} onClick={()=>{if(!restore())return;const {from,to}=editor.state.selection;onComment({from,to});dismissed.current=true;setRect(null);}}><BlockGlyph type="comment"/><span>{t('actions.comment')}</span></button>:null}<button type="button" className="rich-format-reaction" aria-disabled="true" aria-label={t('comments.reaction')+' · '+common('comingSoon')} data-editor-tooltip={t('comments.reaction')+' · '+common('comingSoon')}><SmilePlus aria-hidden="true"/></button></div>
    </>}
    {page==='turn'&&typeAnchor?<RichPopover owner={owner} anchor={typeAnchor} side="right" label={t('actions.turn')} onClose={()=>setPage('main')} width={280}><OverlayScroll className="rich-format-menu-scroll" fitContent>{types.filter(type=>target&&canChangeBlock(target.node,type)).map(type=><button type="button" className="rich-menu-row" key={type} aria-current={kind===type?'true':undefined} onClick={()=>{if(!restore())return;const block=blockAt(editor,editor.state.selection.from);if(block)changeBlock(editor,block,type);setPage('main');}}><BlockGlyph type={type}/><span>{t(`blocks.${type}`)}</span>{kind===type?<BlockGlyph type="resolve"/>:null}</button>)}</OverlayScroll></RichPopover>:null}
    {page==='color'&&colorMenuAnchor?<BlockColorMenu owner={owner} anchor={colorMenuAnchor} text={editor.getAttributes('textStyle').color} background={editor.getAttributes('textStyle').backgroundColor} onClose={()=>setPage('main')} onPick={(type,value)=>{if(restore())editor.commands.setMark('textStyle',{...editor.getAttributes('textStyle'),[type==='text'?'color':'backgroundColor']:value});}}/>:null}
  </OverlaySurface>,document.body):null}</OverlayPresence>;
}
