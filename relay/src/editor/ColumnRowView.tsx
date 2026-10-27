'use client';
import {useLayoutEffect,useRef,type ReactNode,type CSSProperties} from 'react';
import {columnRowBounds} from '../domain/blocks/columns';

/** Read-only documents use the same persisted edge fractions as the editor. */
export function ColumnRowView({start,end,count,children}:{start:number|null;end:number|null;count:number;children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const element=ref.current,parent=element?.parentElement;if(!element||!parent)return;
    const column=parent.closest<HTMLElement>('.relay-column');
    const workspace=column??parent.closest<HTMLElement>('.relay-page')?.parentElement??parent;
    const update=()=>{const normal=parent.getBoundingClientRect(),canvas=workspace.getBoundingClientRect(),inset=column?0:24;
      const work={left:Math.max(inset,canvas.left+inset),right:Math.min(innerWidth-inset,canvas.right-inset)};
      const bounds=columnRowBounds(work,normal,start,end);element.style.width=`${bounds.right-bounds.left}px`;element.style.marginInlineStart=`${bounds.left-normal.left}px`;
    };
    update();const observer=new ResizeObserver(update);observer.observe(parent);if(workspace!==parent)observer.observe(workspace);window.addEventListener('resize',update);
    return()=>{observer.disconnect();window.removeEventListener('resize',update);};
  },[start,end]);
  return <div ref={ref} className="relay-columns" style={{'--column-count':count} as CSSProperties}><div className="relay-columns-content">{children}</div></div>;
}
