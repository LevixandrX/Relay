"use client";
import {useLayoutEffect,useRef} from 'react';
import {belowTooltip} from './tooltip-position';
export function TableSizeTooltip({button,rows,columns}:{button:HTMLElement;rows:number;columns:number}){
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{const el=root.current;if(!el)return;const pos=belowTooltip(button.getBoundingClientRect(),el.getBoundingClientRect(),{width:innerWidth,height:innerHeight});el.style.left=pos.left+'px';el.style.top=pos.top+'px';});
  return <div ref={root} role="status" className="rich-table-size-tip">{columns} × {rows}</div>;
}
