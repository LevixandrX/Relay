"use client";
import {bindHorizontalScroll} from './horizontal-scroll';
import {createRef} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {TableView} from '@tiptap/extension-table';
import {TableMap} from '@tiptap/pm/tables';
import type {Node as PMNode} from '@tiptap/pm/model';
import type {EditorView} from '@tiptap/pm/view';
import {CompactRailScroll} from '../lib/board/CompactRailScroll';

/** Fixed independent columns, with a workspace-wide horizontal scroll port. */
export class RelayTableView extends TableView{
  private viewport:HTMLDivElement;private rail:Root;private observer:ResizeObserver;private positionObserver:MutationObserver;private frame=0;private measured='';private base:number;private view:EditorView;private wheel:()=>void;
  constructor(node:PMNode,min:number,view:EditorView,attrs:Record<string,unknown>={}){
    super(node,min,view,attrs);this.view=view;this.base=Math.max(240,view.dom.clientWidth||720);
    this.viewport=document.createElement('div');this.viewport.className='rich-table-scrollport';this.dom.replaceChild(this.viewport,this.table);this.viewport.append(this.table);this.viewport.addEventListener('scroll',this.overflow,{passive:true});this.wheel=bindHorizontalScroll(this.dom,this.viewport);
    const track=document.createElement('div');track.className='rich-table-scrollbar';track.contentEditable='false';this.dom.append(track);const ref=createRef<HTMLElement>();ref.current=this.viewport;this.rail=createRoot(track);this.rail.render(<CompactRailScroll target={ref} axis="horizontal" arrows/>);
    this.observer=new ResizeObserver(this.schedule);this.observer.observe(view.dom);this.observer.observe(this.dom);this.observer.observe(this.table);
    this.positionObserver=new MutationObserver(this.schedule);const host=view.dom.closest('.relay-editor');if(host)this.positionObserver.observe(host,{attributes:true,attributeFilter:['style','class','data-editor-layout']});
    this.dom.addEventListener('pointerdown',this.freeze,true);window.addEventListener('resize',this.schedule);
    this.columns();this.schedule();
  }
  private overflow=()=>{this.dom.dataset.overflowRight=String(this.viewport.scrollWidth-this.viewport.clientWidth-this.viewport.scrollLeft>2);};
  private schedule=()=>{if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.layout();});};
  private appearance(){const a=this.node.attrs;if(a.blockId){this.dom.dataset.blockId=a.blockId;this.dom.id=a.blockId;}else{delete this.dom.dataset.blockId;this.dom.removeAttribute('id');}for(const [attr,data,css] of [['textColor','textColor','--block-text'],['blockBackground','blockBackground','--block-bg']] as const){if(a[attr]){this.dom.dataset[data]=a[attr];this.dom.style.setProperty(css,a[attr]);}else{delete this.dom.dataset[data];this.dom.style.removeProperty(css);}}}
  private columns(){this.appearance();const map=TableMap.get(this.node),cols=Array.from(this.colgroup.children) as HTMLTableColElement[];let width=0;for(let c=0;c<map.width;c++){const offset=map.map[c],cell=this.node.nodeAt(offset)!,r=map.findCell(offset),size=cell.attrs.colwidth?.[c-r.left]||Math.max(this.cellMinWidth,Math.round(this.base/map.width));if(cols[c]){cols[c].style.width=size+'px';cols[c].style.minWidth='';}width+=size;}this.table.style.width=width+'px';this.table.style.minWidth='';this.dom.style.setProperty('--table-width',width+'px');}
  private layout=()=>{if(!this.dom.isConnected)return;const base=this.view.dom.clientWidth;if(base>0&&base!==this.base){this.base=base;if(Array.from({length:this.node.firstChild?.childCount??0},(_,i)=>this.node.firstChild!.child(i)).some(cell=>!cell.attrs.colwidth))this.columns();}const r=this.dom.getBoundingClientRect();let left=0,right=innerWidth;for(let p=this.view.dom.parentElement;p&&p!==document.body;p=p.parentElement){if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)){const b=p.getBoundingClientRect();left=Math.max(left,b.left+p.clientLeft);right=Math.min(right,b.left+p.clientLeft+p.clientWidth);}}
    this.dom.style.setProperty('--table-height',this.table.offsetHeight+'px');this.overflow();
    const inset=Math.max(0,r.left-left-16),width=Math.max(180,right-left-32);this.viewport.style.width=width+'px';this.viewport.style.marginLeft=-inset+'px';this.viewport.style.paddingLeft=inset+'px';this.dom.style.setProperty('--table-inset',inset+'px');this.viewport.style.paddingRight='32px';const track=this.dom.querySelector<HTMLElement>('.rich-table-scrollbar')!;track.style.width=width+'px';track.style.marginLeft=-inset+'px';const measured=this.table.offsetWidth+':'+this.table.offsetHeight;if(measured!==this.measured){this.measured=measured;this.view.dom.dispatchEvent(new Event('relay:table-layout'));}
  };
  private freeze=(event:PointerEvent)=>{if(event.button!==0||!(event.target instanceof Element)||!event.target.closest('td,th'))return;const cell=event.target.closest('td,th')!,r=cell.getBoundingClientRect();if(Math.abs(event.clientX-r.right)>7&&Math.abs(event.clientX-r.left)>7)return;
    const first=this.table.rows[0];if(!first)return;const map=TableMap.get(this.node),widths=Array.from({length:map.width},(_,i)=>{const offset=map.map[i],area=map.findCell(offset),dom=this.view.nodeDOM(this.tablePos()+1+offset) as HTMLElement;return Math.max(this.cellMinWidth,Math.round(dom.getBoundingClientRect().width/(area.right-area.left)));});
    const pos=this.tablePos(),tr=this.view.state.tr;for(const offset of new Set(map.map)){const node=this.node.nodeAt(offset)!,a=map.findCell(offset),values=widths.slice(a.left,a.right);if(JSON.stringify(values)!==JSON.stringify(node.attrs.colwidth))tr.setNodeMarkup(pos+1+offset,undefined,{...node.attrs,colwidth:values});}if(tr.docChanged)this.view.dispatch(tr.setMeta('addToHistory',false));
  };
  private tablePos(){const cell=this.table.querySelector('td,th');if(!cell)return 0;const $pos=this.view.state.doc.resolve(this.view.posAtDOM(cell,0));for(let d=$pos.depth;d>0;d--)if($pos.node(d).type.name==='table')return $pos.before(d);return 0;}
  update(node:PMNode){if(!super.update(node))return false;this.columns();return true;}
  destroy(){this.viewport.removeEventListener('scroll',this.overflow);this.wheel();cancelAnimationFrame(this.frame);this.observer.disconnect();this.positionObserver.disconnect();this.dom.removeEventListener('pointerdown',this.freeze,true);window.removeEventListener('resize',this.schedule);const root=this.rail;queueMicrotask(()=>root.unmount());}
}
