"use client";
import {focusAfterBlockRender,stopBlockToolEvent} from './node-view-events';
import {Node,mergeAttributes} from '@tiptap/core';
import {NodeViewWrapper,NodeViewContent,ReactNodeViewRenderer,type ReactNodeViewProps} from '@tiptap/react';
import {TextSelection} from '@tiptap/pm/state';
import {useTranslations} from 'use-intl';
import {useEffect,useState} from 'react';
function ToggleView({node,editor,getPos,updateAttributes}:ReactNodeViewProps){
  const t=useTranslations('editorTools.rich'),empty=node.lastChild?.childCount===1&&!node.lastChild.firstChild?.content.size;
  const [inBody,setInBody]=useState(false);
  useEffect(()=>{const update=()=>{const pos=getPos();setInBody(typeof pos==='number'&&editor.state.selection.from>pos+node.firstChild!.nodeSize+1&&editor.state.selection.to<pos+node.nodeSize);};update();editor.on('selectionUpdate',update);return()=>{editor.off('selectionUpdate',update);};},[editor,getPos,node]);
  const inside=()=>{const pos=getPos();if(typeof pos==='number')editor.chain().focus().setTextSelection(pos+node.firstChild!.nodeSize+3).run();};
  return <NodeViewWrapper className="rich-toggle" data-open={String(node.attrs.open)} data-level={node.attrs.level} data-empty={empty} data-editing-body={inBody}>
    <button type="button" className="rich-toggle-button" contentEditable={false} aria-label={node.firstChild?.textContent||t('toggleTitle')} aria-expanded={node.attrs.open} disabled={!editor.isEditable} onMouseDown={e=>e.preventDefault()} onClick={()=>{const pos=getPos();if(typeof pos!=='number')return;if(node.attrs.open&&editor.state.selection.from>pos+node.firstChild!.nodeSize)editor.commands.setTextSelection(pos+2);updateAttributes({open:!node.attrs.open});}}><svg viewBox="0 0 16 16" aria-hidden><path d="m5 3 7 5-7 5Z" fill="currentColor"/></svg></button>
    <NodeViewContent className="rich-toggle-inner"/>
    {!node.firstChild?.content.size?<span className="rich-toggle-title-placeholder" contentEditable={false}>{t('toggleTitle')}</span>:null}
    {empty&&node.attrs.open&&editor.isEditable?<button type="button" className="rich-toggle-empty" contentEditable={false} onMouseDown={e=>{e.preventDefault();inside();}}>{t('toggleEmpty')}</button>:null}
  </NodeViewWrapper>;
}
export const ToggleTitle=Node.create({name:'toggleTitle',content:'inline*',defining:true,parseHTML(){return[{tag:'div[data-toggle-title]'}];},renderHTML({HTMLAttributes}){return['div',mergeAttributes(HTMLAttributes,{'data-toggle-title':''}),0];}});
export const ToggleContent=Node.create({name:'toggleContent',content:'block+',defining:true,parseHTML(){return[{tag:'div[data-toggle-content]'}];},renderHTML({HTMLAttributes}){return['div',mergeAttributes(HTMLAttributes,{'data-toggle-content':''}),0];}});
export const Toggle=Node.create({
  name:'toggle',group:'block',content:'toggleTitle toggleContent',defining:true,
  addAttributes(){return{open:{default:false,parseHTML:el=>el.getAttribute('open')==='true'},level:{default:0,parseHTML:el=>Number(el.getAttribute('level'))||0}};},
  parseHTML(){return[{tag:'div[data-rich-toggle]'}];},renderHTML({HTMLAttributes}){return['div',mergeAttributes(HTMLAttributes,{'data-rich-toggle':'',class:'rich-toggle'}),0];},
  addKeyboardShortcuts(){return{
    Enter:()=>{
      const {state,view}=this.editor,{$from,$to}=state.selection;
      if($from.parent.type.name==='toggleTitle'&&$from.sameParent($to)){
        const pos=$from.before($from.depth-1),toggle=state.doc.nodeAt(pos)!,body=pos+toggle.firstChild!.nodeSize+1;
        if(!toggle.firstChild!.content.size&&toggle.lastChild!.childCount===1&&!toggle.lastChild!.firstChild!.content.size){const tr=state.tr.replaceWith(pos,pos+toggle.nodeSize,state.schema.nodes.paragraph.create(toggle.attrs));tr.setSelection(TextSelection.create(tr.doc,pos+1));view.dispatch(tr.scrollIntoView());focusAfterBlockRender(this.editor);return true;}
        if(!toggle.attrs.open){const tail=$from.parent.content.cut($to.parentOffset),tr=state.tr.delete(state.selection.from,$from.end()),current=tr.doc.nodeAt(pos)!,next=toggle.type.create({...toggle.attrs,blockId:null},[state.schema.nodes.toggleTitle.create(null,tail),state.schema.nodes.toggleContent.create(null,state.schema.nodes.paragraph.create())]),at=pos+current.nodeSize;tr.insert(at,next);tr.setSelection(TextSelection.create(tr.doc,at+2));view.dispatch(tr.scrollIntoView());focusAfterBlockRender(this.editor);return true;}
        const tail=$from.parent.content.cut($to.parentOffset),tr=state.tr.delete(state.selection.from,$from.end());
        const mappedBody=tr.mapping.map(body),first=tr.doc.nodeAt(mappedBody)!.firstChild!;
        if(tail.size){if(first.type.name==='paragraph')tr.insert(mappedBody+2,tail);else tr.insert(mappedBody+1,state.schema.nodes.paragraph.create(null,tail));}
        tr.setNodeMarkup(pos,undefined,{...toggle.attrs,open:true});tr.setSelection(TextSelection.create(tr.doc,mappedBody+2));view.dispatch(tr.scrollIntoView());focusAfterBlockRender(this.editor);return true;
      }
      if(state.selection.empty&&$from.parent.type.name==='paragraph'&&!$from.parent.content.size&&$from.node($from.depth-1).type.name==='toggleContent'&&$from.index($from.depth-1)===$from.node($from.depth-1).childCount-1){
        const depth=$from.depth-2,end=$from.after(depth),tr=state.tr;
        if($from.node($from.depth-1).childCount>1)tr.delete($from.before(),$from.after());
        const insert=tr.mapping.map(end);tr.insert(insert,state.schema.nodes.paragraph.create());tr.setSelection(TextSelection.create(tr.doc,insert+1));view.dispatch(tr.scrollIntoView());focusAfterBlockRender(this.editor);return true;
      }return false;
    },
    Backspace:()=>{const {state,view}=this.editor,{$from,empty}=state.selection;if(!empty||$from.parentOffset!==0)return false;if($from.parent.type.name==='toggleTitle'){const pos=$from.before($from.depth-1),toggle=state.doc.nodeAt(pos)!,blocks=[state.schema.nodes.paragraph.create(toggle.attrs,$from.parent.content)];toggle.lastChild!.forEach(child=>{if(child.content.size||toggle.lastChild!.childCount>1)blocks.push(child);});const tr=state.tr.replaceWith(pos,pos+toggle.nodeSize,blocks);tr.setSelection(TextSelection.create(tr.doc,pos+1));view.dispatch(tr.scrollIntoView());focusAfterBlockRender(this.editor);return true;}if($from.node($from.depth-1)?.type.name!=='toggleContent'||$from.index($from.depth-1)!==0||$from.parent.content.size)return false;const depth=$from.depth-2,titleEnd=$from.before(depth)+$from.node(depth).firstChild!.nodeSize;view.dispatch(state.tr.setSelection(TextSelection.create(state.doc,titleEnd)));return true;},
    'Mod-Enter':()=>{const {$from}=this.editor.state.selection;for(let d=$from.depth;d>0;d--)if($from.node(d).type.name==='toggle'){const pos=$from.before(d),node=$from.node(d),tr=this.editor.state.tr.setNodeMarkup(pos,undefined,{...node.attrs,open:!node.attrs.open});if(node.attrs.open)tr.setSelection(TextSelection.create(tr.doc,pos+2));this.editor.view.dispatch(tr);return true;}return false;}
  };},
  addNodeView(){return ReactNodeViewRenderer(ToggleView,{attrs:({HTMLAttributes})=>HTMLAttributes,stopEvent:stopBlockToolEvent});}
});
