"use client";
import {focusBlock} from "./focus-editor";
import {useState} from 'react';
import {NodeViewWrapper,type ReactNodeViewProps} from '@tiptap/react';
import {useTranslations} from 'use-intl';
import {RichPopover} from './RichPopover';
import {mathHTML} from './math';
export function EquationView({node,editor,updateAttributes,getPos}:ReactNodeViewProps){
  const t=useTranslations('editorTools.rich'),latex=String(node.attrs.latex||''),inline=node.type.name==='inlineEquation', [anchor,setAnchor]=useState<HTMLButtonElement|null>(null),[editing,setEditing]=useState(!latex),[draft,setDraft]=useState(latex);
  const save=()=>{updateAttributes({latex:draft.slice(0,4000)});setEditing(false);focusBlock(editor,getPos());};
  return <NodeViewWrapper as={inline?'span':'div'} className={inline?'rich-inline-equation':'rich-equation'} contentEditable={false}>
    <button ref={setAnchor} type="button" className="rich-equation-preview" data-empty={!latex} disabled={!editor.isEditable} aria-label={t('editEquation')} onClick={()=>{setDraft(latex);setEditing(true);}}>{latex?<span dangerouslySetInnerHTML={{__html:mathHTML(latex,!inline)}}/>:<span className="rich-equation-placeholder"><span aria-hidden>∑</span>{t('equation')}</span>}</button>
    {editing&&editor.isEditable&&anchor?<RichPopover scrollContent anchor={anchor} width={384} label={t('editEquation')} onClose={()=>setEditing(false)}><div className="rich-equation-form"><label>{t('latex')}<textarea autoFocus maxLength={4000} value={draft} placeholder="E = mc^2" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();save();}}}/></label><small>{t('preview')}</small><div className="rich-equation-live" dangerouslySetInnerHTML={{__html:mathHTML(draft,!inline)}}/><footer><span>LaTeX</span><button type="button" onClick={()=>setEditing(false)}>{t('cancel')}</button><button type="button" data-primary onClick={save}>{t('done')}</button></footer></div></RichPopover>:null}
  </NodeViewWrapper>;
}
