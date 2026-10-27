import type {Editor} from '@tiptap/core';
import type {Node as PMNode} from '@tiptap/pm/model';
import {closeHistory} from '@tiptap/pm/history';
import {columnRowBounds} from '../domain/blocks/columns';
import {editorCanvas} from './use-editor-canvas';
import {editorClipRect} from './use-block-handles';

export function columnRowWidth(editor:Editor,dom:HTMLElement,node:()=>PMNode,getPos:()=>number|undefined,labels:{start:string;end:string}){
  const controls=document.createElement('div');controls.className='relay-column-edges';controls.contentEditable='false';dom.append(controls);
  let frame=0,dead=false,stop:(()=>void)|null=null;
  const geometry=()=>{
    const parent=dom.parentElement?.getBoundingClientRect()??editor.view.dom.getBoundingClientRect();
    const column=dom.parentElement?.closest<HTMLElement>('[data-type="column"]');
    if(column)return {normal:parent,work:{left:parent.left,right:parent.right}};
    const canvas=editorCanvas(editor).getBoundingClientRect(),clip=editorClipRect(editor);
    const compact=editor.view.dom.closest<HTMLElement>('.relay-editor')?.dataset.annotationsSide==='false';
    return {normal:parent,work:{left:Math.max(canvas.left,clip.left)+64,right:Math.min(canvas.right,clip.right)-(compact?64:24)}};
  };
  const publish=(left:number,right:number,normalLeft:number)=>{
    if(dom.style.getPropertyValue('--column-row-width')===`${right-left}px`&&dom.style.getPropertyValue('--column-row-offset')===`${left-normalLeft}px`)return;
    dom.style.setProperty('--column-row-width',`${right-left}px`);dom.style.setProperty('--column-row-offset',`${left-normalLeft}px`);
    const {work}=geometry(),span=Math.max(1,work.right-work.left);
    controls.querySelector('[data-edge="start"]')?.setAttribute('aria-valuenow',String(Math.round((left-work.left)/span*100)));
    controls.querySelector('[data-edge="end"]')?.setAttribute('aria-valuenow',String(Math.round((right-work.left)/span*100)));
    editor.view.dom.dispatchEvent(new Event('relay:row-layout'));
  };
  const update=()=>{
    if(dead||stop||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;if(dead||stop)return;const {normal,work}=geometry(),attrs=node().attrs;
      const bounds=columnRowBounds(work,normal,attrs.layoutStart??null,attrs.layoutEnd??null);publish(bounds.left,bounds.right,normal.left);
    });
  };
  const commit=(side:'start'|'end',fraction:number)=>{
    const pos=getPos();if(typeof pos!=='number'||!editor.isEditable)return;
    const current=editor.state.doc.nodeAt(pos);if(current?.type.name!=='columns')return;
    const key=side==='start'?'layoutStart':'layoutEnd';
    if(current.attrs[key]===fraction)return;
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,{...current.attrs,[key]:fraction}));
  };
  for(const side of ['start','end'] as const){
    const button=document.createElement('button');button.type='button';button.dataset.columnResize='edge';button.dataset.edge=side;
    button.setAttribute('role','separator');button.setAttribute('aria-orientation','vertical');button.setAttribute('aria-label',labels[side]);
    button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','100');
    button.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();
      const {work}=geometry(),bounds=dom.getBoundingClientRect(),span=Math.max(1,work.right-work.left);
      const x=(side==='start'?bounds.left:bounds.right)+(event.key==='ArrowLeft'?-24:24);
      const left=side==='start'?Math.max(work.left,Math.min(bounds.right-Math.min(240,span),x)):bounds.left;
      const right=side==='end'?Math.min(work.right,Math.max(bounds.left+Math.min(240,span),x)):bounds.right;
      commit(side,Number(((side==='start'?left-work.left:right-work.left)/span).toFixed(6)));update();
    };
    button.onpointerdown=event=>{
      if(event.button!==0||!editor.isEditable)return;event.preventDefault();event.stopPropagation();stop?.();cancelAnimationFrame(frame);frame=0;
      const {normal,work}=geometry(),initial=dom.getBoundingClientRect(),span=Math.max(1,work.right-work.left),minimum=Math.min(240,span);
      const origin=event.clientX,from=side==='start'?initial.left:initial.right;
      let desired=from,painted=from,paintFrame=0,last=performance.now(),released=false;
      const smooth=!matchMedia('(prefers-reduced-motion: reduce)').matches;
      button.setPointerCapture(event.pointerId);button.dataset.resizing='true';dom.dataset.resizing='true';
      const clean=()=>{stop=null;cancelAnimationFrame(paintFrame);delete button.dataset.resizing;delete dom.dataset.resizing;
        if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
        window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelPointer);window.removeEventListener('blur',up);window.removeEventListener('keydown',cancel,true);update();};
      const paint=(time:number)=>{paintFrame=0;const dt=Math.max(1,Math.min(50,time-last));last=time;
        painted=smooth?painted+(desired-painted)*(1-Math.exp(-dt/38)):desired;
        const settled=Math.abs(desired-painted)<.15;if(settled)painted=desired;
        publish(side==='start'?painted:initial.left,side==='end'?painted:initial.right,normal.left);
        if(settled&&released)clean();else if(!settled)paintFrame=requestAnimationFrame(paint);
      };
      const move=(next:PointerEvent)=>{if(next.pointerId!==event.pointerId||released)return;next.preventDefault();const x=from+next.clientX-origin;
        desired=side==='start'?Math.max(work.left,Math.min(initial.right-minimum,x)):Math.min(work.right,Math.max(initial.left+minimum,x));
        if(!paintFrame){last=performance.now()-16;paintFrame=requestAnimationFrame(paint);}
      };
      const up=(next?:Event)=>{if(released||next instanceof PointerEvent&&next.pointerId!==event.pointerId)return;if(next instanceof PointerEvent)move(next);
        released=true;commit(side,Number(((desired-work.left)/span).toFixed(6)));if(!paintFrame)clean();};
      const cancelPointer=(next:PointerEvent)=>{if(next.pointerId===event.pointerId)clean();};
      const cancel=(next:KeyboardEvent)=>{if(next.key==='Escape'){next.preventDefault();next.stopImmediatePropagation();clean();}};
      stop=clean;window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancelPointer);window.addEventListener('blur',up);window.addEventListener('keydown',cancel,true);
    };
    controls.append(button);
  }
  const observer=new ResizeObserver(update);
  const observeFrame=requestAnimationFrame(()=>{if(!dead){observer.observe(editorCanvas(editor));observer.observe(editor.view.dom);update();}});
  window.addEventListener('resize',update);editor.on('transaction',update);update();
  return {update,contains:(target:Node)=>controls.contains(target),destroy(){dead=true;stop?.();cancelAnimationFrame(frame);cancelAnimationFrame(observeFrame);observer.disconnect();window.removeEventListener('resize',update);editor.off('transaction',update);}};
}
