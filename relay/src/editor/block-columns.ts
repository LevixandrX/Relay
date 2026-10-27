import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import {MAX_COLUMNS, columnIndentBase, resizedColumnPair} from '../domain/blocks/columns';
import {syncBlockDom} from './block-dom-attributes';
import {columnRowWidth} from './column-row-width';

const baseIndent=(node:PMNode)=>{
  const indents:number[]=[];
  node.forEach(child=>indents.push(Number(child.attrs.blockIndent)||0));
  return columnIndentBase(indents);
};
// Scale relative weights so a sum below one still fills the entire flex row.
const flexGrow=(width:number)=>String(width*100);

export const BlockColumn=Node.create({
  name:'column', content:'block+', isolating:true, selectable:true,
  addAttributes(){return {width:{default:1,parseHTML:el=>Number(el.getAttribute('data-column-width'))||1,renderHTML:attrs=>({'data-column-width':attrs.width,style:`flex-grow: ${flexGrow(attrs.width)}`})}};},
  parseHTML(){return [{tag:'div[data-type="column"]'}];},
  renderHTML({node,HTMLAttributes}){return ['div',mergeAttributes(HTMLAttributes,{'data-type':'column',class:'relay-column',style:`--column-base-indent: ${baseIndent(node)}`}),0];},
  addNodeView(){return ({node})=>{
    let current=node;
    const dom=document.createElement('div');dom.className='relay-column';dom.dataset.type='column';
    const update=()=>{syncBlockDom(dom,current);dom.dataset.columnWidth=String(current.attrs.width);dom.style.flexGrow=flexGrow(Number(current.attrs.width)||1);dom.style.setProperty('--column-base-indent',String(baseIndent(current)));};
    update();
    return {dom,contentDOM:dom,update(next){if(next.type!==current.type)return false;current=next;update();return true;},ignoreMutation:mutation=>mutation.type==='attributes'&&mutation.target===dom};
  };},
});

export const BlockColumns=Node.create({
  name:'columns',group:'block',content:`column{2,${MAX_COLUMNS}}`,isolating:true,defining:true,
  addOptions(){return {resizeLabel:'Resize columns',resizeStartLabel:'Resize row from left',resizeEndLabel:'Resize row from right'};},
  addAttributes(){return Object.fromEntries(['layoutStart','layoutEnd'].map((name,index)=>[name,{default:null,parseHTML:(element:HTMLElement)=>{const value=element.getAttribute(index?'data-row-end':'data-row-start');return value===null?null:Number(value);},renderHTML:(attrs:Record<string,unknown>)=>attrs[name]!=null?{[index?'data-row-end':'data-row-start']:attrs[name]}:{}}]));},
  parseHTML(){return [{tag:'div[data-type="columns"]'}];},
  renderHTML({node,HTMLAttributes}){return ['div',mergeAttributes(HTMLAttributes,{'data-type':'columns',class:'relay-columns',style:`--column-count: ${node.childCount}`}),['div',{class:'relay-columns-content'},0]];},
  addNodeView(){return ({node,editor,getPos})=>{
    let current=node,dead=false,frame=0,endResize:(()=>void)|null=null;
    const dom=document.createElement('div'),contentDOM=document.createElement('div'),guides=document.createElement('div');
    dom.className='relay-columns';dom.dataset.type='columns';contentDOM.className='relay-columns-content';
    guides.className='relay-column-guides';guides.contentEditable='false';dom.append(contentDOM,guides);
    const widthOptions=editor.extensionManager.extensions.find(extension=>extension.name==='columns')?.options;
    const rowWidth=columnRowWidth(editor,dom,()=>current,getPos,{start:widthOptions?.resizeStartLabel??'Resize row from left',end:widthOptions?.resizeEndLabel??'Resize row from right'});
    const position=()=>{
      if(dead)return;
      const children=Array.from(contentDOM.children) as HTMLElement[];
      const bounds=children.map(child=>child.getBoundingClientRect()),origin=dom.getBoundingClientRect().left;
      const gap=children.length>1?Math.max(0,bounds[1].left-bounds[0].right):32;
      dom.style.setProperty('--column-paint-pad',`${Math.min(8,Math.max(0,(gap-8)/2))}px`);
      const stacked=getComputedStyle(contentDOM).flexDirection==='column';
      Array.from(guides.children).forEach((element,i)=>{
        const button=element as HTMLButtonElement,a=children[i],b=children[i+1];
        if(a&&b)button.style.transform=`translate3d(${(bounds[i].right+bounds[i+1].left)/2-origin}px,0,0) translateX(-50%)`;
        button.hidden=!editor.isEditable||stacked;
        const left=Number(current.child(i).attrs.width)||1,right=Number(current.child(i+1).attrs.width)||1;
        button.setAttribute('aria-valuenow',String(Math.round(left/(left+right)*100)));
      });
    };
    const schedule=()=>{if(!dead&&!frame)frame=requestAnimationFrame(()=>{frame=0;position();});};
    const resize=(index:number,left:number,right:number)=>{
      const start=getPos();if(typeof start!=='number'||!editor.isEditable)return;
      const group=editor.state.doc.nodeAt(start);if(group?.type.name!=='columns'||index+1>=group.childCount)return;
      let pos=start+1;for(let i=0;i<index;i++)pos+=group.child(i).nodeSize;
      const a=group.child(index),b=group.child(index+1);if(a.attrs.width===left&&b.attrs.width===right)return;
      const tr=closeHistory(editor.state.tr);
      tr.setNodeMarkup(pos,undefined,{...a.attrs,width:left});
      tr.setNodeMarkup(pos+a.nodeSize,undefined,{...b.attrs,width:right});editor.view.dispatch(tr);
    };
    const renderGuides=()=>{
      syncBlockDom(dom,current);
      dom.style.setProperty('--column-count',String(current.childCount));guides.replaceChildren();
      for(let i=0;i<current.childCount-1;i++){
        const button=document.createElement('button');button.type='button';button.dataset.columnResize='true';
        button.setAttribute('role','separator');button.setAttribute('aria-orientation','vertical');
        button.setAttribute('aria-label',editor.extensionManager.extensions.find(extension=>extension.name==='columns')?.options.resizeLabel??'Resize columns');
        button.setAttribute('aria-valuemin','10');button.setAttribute('aria-valuemax','90');
        button.onkeydown=event=>{
          if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();
          const a=Number(current.child(i).attrs.width)||1,b=Number(current.child(i+1).attrs.width)||1;
          resize(i,...resizedColumnPair(a,b,(a+b)*(event.key==='ArrowLeft'?-.05:.05)));
        };
        button.onpointerdown=event=>{
          if(event.button!==0||!editor.isEditable)return;
          event.preventDefault();event.stopPropagation();endResize?.();
          const children=Array.from(contentDOM.children) as HTMLElement[];
          const a=Number(current.child(i).attrs.width)||1,b=Number(current.child(i+1).attrs.width)||1,total=a+b;
          const pixels=children[i].getBoundingClientRect().width+children[i+1].getBoundingClientRect().width,origin=event.clientX;
          let desired=a,painted=a,lastTime=performance.now(),paintFrame=0,released=false;
          const smooth=!matchMedia('(prefers-reduced-motion: reduce)').matches;
          // Transient sizing never enters editable DOM attributes or autosave.
          const previews=[children[i],children[i+1]].map((child,index)=>child.animate([{flexGrow:flexGrow(index?b:a)}],{duration:0,fill:'forwards'}));
          button.setPointerCapture(event.pointerId);button.dataset.resizing='true';dom.dataset.resizing='true';
          const cleanup=()=>{
            endResize=null;cancelAnimationFrame(paintFrame);previews.forEach(preview=>preview.cancel());
            delete button.dataset.resizing;delete dom.dataset.resizing;
            if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
            window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancelPointer);
            window.removeEventListener('blur',finish);window.removeEventListener('keydown',cancel,true);schedule();
          };
          const paint=(time:number)=>{
            paintFrame=0;if(dead)return;
            const dt=Math.max(1,Math.min(50,time-lastTime));lastTime=time;
            painted=smooth?painted+(desired-painted)*(1-Math.exp(-dt/38)):desired;
            const settled=Math.abs(desired-painted)/total*pixels<.15;
            if(settled)painted=desired;
            [painted,total-painted].forEach((width,index)=>(previews[index].effect as KeyframeEffect).setKeyframes([{flexGrow:flexGrow(width)}]));
            position();
            if(released&&settled)cleanup();else if(!settled)paintFrame=requestAnimationFrame(paint);
          };
          const move=(next:PointerEvent)=>{
            if(next.pointerId!==event.pointerId||released)return;next.preventDefault();
            desired=resizedColumnPair(a,b,(next.clientX-origin)/Math.max(1,pixels)*total)[0];
            if(!paintFrame){lastTime=performance.now()-16;paintFrame=requestAnimationFrame(paint);}
          };
          const finish=(next?:Event)=>{
            if(released||next instanceof PointerEvent&&next.pointerId!==event.pointerId)return;
            if(next instanceof PointerEvent)move(next);
            released=true;resize(i,...resizedColumnPair(a,b,desired-a));if(!paintFrame)cleanup();
          };
          const cancelPointer=(next:PointerEvent)=>{if(next.pointerId===event.pointerId)cleanup();};
          const cancel=(next:KeyboardEvent)=>{if(next.key==='Escape'){next.preventDefault();next.stopImmediatePropagation();cleanup();}};
          endResize=cleanup;
          window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancelPointer);
          window.addEventListener('blur',finish);window.addEventListener('keydown',cancel,true);
        };
        guides.append(button);
      }
      schedule();
    };
    const observer=new ResizeObserver(schedule);observer.observe(contentDOM);
    editor.on('transaction',schedule);renderGuides();
    return {dom,contentDOM,update(next){if(next.type!==current.type)return false;const changed=next.childCount!==current.childCount;current=next;syncBlockDom(dom,current);rowWidth.update();if(changed){endResize?.();renderGuides();}else schedule();return true;},stopEvent:event=>event.target instanceof Element&&Boolean(event.target.closest('[data-column-resize]')),ignoreMutation:mutation=>mutation.type!=='selection'&&(mutation.target===dom||guides.contains(mutation.target)||rowWidth.contains(mutation.target)),destroy(){dead=true;endResize?.();rowWidth.destroy();observer.disconnect();cancelAnimationFrame(frame);editor.off('transaction',schedule);}};
  };},
});
