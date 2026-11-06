"use client";
import {useEffect,useId,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {tableHoverEdge} from './table-hover-edge';
import {tableDragPosition} from './table-drag-geometry';
import {TableSizeTooltip} from './TableSizeTooltip';
import {undo,closeHistory} from '@tiptap/pm/history';
import {createPortal} from 'react-dom';
import type {Editor} from '@tiptap/core';
import type {SelectionBookmark,Transaction} from '@tiptap/pm/state';
import {useTranslations} from 'use-intl';
import {CellSelection,TableMap} from '@tiptap/pm/tables';
import {tableAxisRange,moveTableRange} from './table-range';
import {tableDragPresentation} from './table-presentation';
import {axisCells,selectAxis,canAxisAction,runAxisAction,resizeTable,type TableAxis,type AxisAction,type TableGesture} from './table-axis';
import {selectedCells,colorTableCells,canCellAction,runCellAction} from './table-selection';
import {RichPopover} from './RichPopover';
import {BlockColorMenu} from './BlockColorMenu';
import {OverlayScroll} from '../lib/board/CompactRailScroll';
import {BlockActivityFooter} from './BlockActivityFooter';
import type {BlockActivityInfo} from '../lib/block-activity';
import type {CommentContext,CommentPerson} from './comment-types';
import {ensureBlockId} from './block-appearance';
import {BlockGlyph} from './block-preview';
import {editorClipRect} from './use-block-handles';
import {editorControlsBlocked,editorControlsCovered} from './use-editor-controls';
import type {BlockTarget} from './block-commands';

type Geometry={origin:{left:number;top:number};pos:number;rect:DOMRect;clip:{left:number;right:number;top:number;bottom:number};rows:DOMRect[];cols:{left:number;right:number}[];row:number;col:number;selection:DOMRect|null};
type Menu={kind:'axis'|'cells';pos:number;axis:TableAxis;index:number;rect:DOMRect};
export function TableControls({editor,visible,onComment,comments,people}:{editor:Editor;visible:boolean;comments?:CommentContext;people?:CommentPerson[];onComment?:(target:BlockTarget,quote:string)=>void}){
  const owner=useId(),t=useTranslations('editorTools.rich'),labels=useTranslations('editorTools');
  const [edges,setEdges]=useState({bottom:false,right:false,corner:false}),[geometry,setGeometry]=useState<Geometry|null>(null),[menu,setMenu]=useState<Menu|null>(null),[query,setQuery]=useState(''),[colorAnchor,setColorAnchor]=useState<HTMLElement|null>(null),[drag,setDrag]=useState<{axis:TableAxis;index:number;to:number;x:number;y:number;html?:string;width?:number;height?:number}|null>(null);
  const [activity,setActivity]=useState<BlockActivityInfo|null>(null);
  const hover=useRef<{pos:number;row:number;col:number}|null>(null),current=useRef<Geometry|null>(null),bookmark=useRef<SelectionBookmark|null>(null),opened=useRef(menu);opened.current=menu;current.current=geometry;
  const handlers=useRef<{move:(e:PointerEvent)=>void;up:(e:PointerEvent)=>void;cancel:()=>void}|null>(null);
  useEffect(()=>{const move=(e:PointerEvent)=>{if(press.current?.pointerId===e.pointerId)handlers.current?.move(e);},up=(e:PointerEvent)=>{if(press.current?.pointerId===e.pointerId)handlers.current?.up(e);},cancel=()=>handlers.current?.cancel();document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);return()=>{if(!editor.isDestroyed)cancel();document.documentElement.classList.remove('editor-table-dragging');document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);};},[editor]);
  const press=useRef<{button:HTMLButtonElement;pointerId:number;anchor:DOMRect;axis:TableAxis;index:number;x:number;y:number;started:boolean;to:number;edge?:boolean;both?:boolean;size:{rows:number;cols:number};unit:{row:number;column:number};history:TableGesture;range:{start:number;end:number};hidden:boolean;cells:number[];boundary:number;html:string;width:number;height:number;offset:{x:number;y:number}}|null>(null);
  useEffect(()=>{
    let frame=0,tables:HTMLTableElement[]=[],previous:{x:number;y:number}|null=null,edge:'row'|'column'|null=null;
    const resize=new ResizeObserver(()=>measure());const collect=()=>{resize.disconnect();resize.observe(editor.view.dom);tables=Array.from(editor.view.dom.querySelectorAll('table'));for(const table of tables){resize.observe(table);for(const row of Array.from(table.rows))resize.observe(row);}};
    const resolveTable=(table:HTMLTableElement)=>{const cell=table.querySelector('td,th');if(!cell)return null;const resolved=editor.state.doc.resolve(editor.view.posAtDOM(cell,0));for(let depth=resolved.depth;depth>0;depth--)if(resolved.node(depth).type.name==='table')return resolved.before(depth);return null;};
    const measure=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;
      const selection=selectedCells(editor.state),h=hover.current??(selection?{pos:selection.tablePos,row:selection.rect.top,col:selection.rect.left}:null),node=h&&editor.state.doc.nodeAt(h.pos),dom=h&&editor.view.nodeDOM(h.pos),table=dom instanceof HTMLElement?(dom.matches('table')?dom:dom.querySelector('table')) as HTMLTableElement|null:null;
      if(!h||node?.type.name!=='table'||!table){setGeometry(null);return;}
      const host=editor.view.dom.closest<HTMLElement>('.relay-editor')!,hostRect=host.getBoundingClientRect(),origin={left:hostRect.left+host.clientLeft,top:hostRect.top+host.clientTop};
      const rect=table.getBoundingClientRect(),map=TableMap.get(node),rows=Array.from(table.rows).map(row=>row.getBoundingClientRect()),cols=Array.from({length:map.width},(_,index)=>{const offset=map.map[index],cell=editor.view.nodeDOM(h.pos+1+offset) as HTMLElement,r=cell.getBoundingClientRect(),area=map.findCell(offset),width=r.width/(area.right-area.left);return{left:r.left+(index-area.left)*width,right:r.left+(index-area.left+1)*width};});
      const clip=editorClipRect(editor);if(dom instanceof HTMLElement){const port=dom.querySelector('.rich-table-scrollport')??dom,bounds=port.getBoundingClientRect();clip.left=Math.max(clip.left,bounds.left);clip.right=Math.min(clip.right,bounds.right);}
      let selected:DOMRect|null=null;
      if(selection?.tablePos===h.pos){const cells=selection.cells.map(({pos})=>editor.view.nodeDOM(pos)).filter((element):element is HTMLElement=>element instanceof HTMLElement).map(element=>element.getBoundingClientRect());if(cells.length){const left=Math.min(...cells.map(cell=>cell.left)),top=Math.min(...cells.map(cell=>cell.top));selected=new DOMRect(left,top,Math.max(...cells.map(cell=>cell.right))-left,Math.max(...cells.map(cell=>cell.bottom))-top);}}
      const surface=host.querySelector<HTMLElement>('.rich-table-cell-outline');if(surface&&selected){Object.assign(surface.style,{left:(selected.left-origin.left)+'px',top:(selected.top-origin.top)+'px',width:selected.width+'px',height:selected.height+'px'});}
      setGeometry({origin,pos:h.pos,rect,rows,cols,clip,row:Math.min(h.row,map.height-1),col:Math.min(h.col,map.width-1),selection:selected});
    });};
    const pointer=(event:PointerEvent)=>{
      if(document.documentElement.classList.contains('rail-scroll-dragging'))return;
      if(press.current||opened.current||event.target instanceof Element&&event.target.closest('.rich-table-controls,.rich-popover'))return;
      if(editorControlsCovered({left:event.clientX,right:event.clientX+.1,top:event.clientY,bottom:event.clientY+.1})){hover.current=null;setEdges({bottom:false,right:false,corner:false});measure();return;}
      const table=tables.find(element=>{const rect=element.getBoundingClientRect();return event.clientX>=rect.left-24&&event.clientX<=rect.right+32&&event.clientY>=rect.top-24&&event.clientY<=rect.bottom+32;});
      if(!table){previous={x:event.clientX,y:event.clientY};edge=null;hover.current=null;setEdges({bottom:false,right:false,corner:false});measure();return;}
      const pos=resolveTable(table);if(pos===null)return;const rect=table.getBoundingClientRect(),rows=Array.from(table.rows),row=Math.max(0,rows.findIndex(element=>event.clientY<element.getBoundingClientRect().bottom)),map=TableMap.get(editor.state.doc.nodeAt(pos)!);
      let col=map.width-1;for(let index=0;index<map.width;index++){const cell=editor.view.nodeDOM(pos+1+map.map[index]);if(cell instanceof HTMLElement&&event.clientX<cell.getBoundingClientRect().right){col=index;break;}}
      hover.current={pos,row:event.clientY>=rect.bottom?map.height-1:row,col};
      const point={x:event.clientX,y:event.clientY},corner=point.x>=rect.right-9&&point.y>=rect.bottom-9;
      const lastRow=row===map.height-1||point.y>=rect.bottom-12,lastCol=col===map.width-1||point.x>=rect.right-12,old=edge;
      edge=tableHoverEdge(point,previous,lastRow,lastCol,edge);
      const dx=Math.abs(point.x-(previous?.x??point.x)),dy=Math.abs(point.y-(previous?.y??point.y));
      if(!previous||edge!==old||!lastRow||!lastCol||(edge==='row'?dy>=14&&dy>dx:dx>=14&&dx>dy))previous=point;
      const next={corner,bottom:!corner&&edge==='row'&&point.y<=rect.bottom+32&&point.x>=rect.left-4,right:!corner&&edge==='column'&&point.x<=rect.right+32&&point.y>=rect.top-4};
      setEdges(old=>old.bottom===next.bottom&&old.right===next.right&&old.corner===next.corner?old:next);measure();
    };
    const transaction=({transaction:tr}:{transaction:Transaction})=>{if(bookmark.current&&tr.docChanged)bookmark.current=bookmark.current.map(tr.mapping);if(tr.docChanged)collect();measure();};
    const scrolling=(event:Event)=>{const target=event.target;if(target!==document&&!(target instanceof Element&&(target.contains(editor.view.dom)||editor.view.dom.contains(target)&&target.querySelector('table'))))return;hover.current=null;setEdges({bottom:false,right:false,corner:false});measure();};
    collect();
    editor.on('transaction',transaction);window.addEventListener('scroll',scrolling,true);window.addEventListener('resize',measure);document.addEventListener('pointermove',pointer);measure();
    return()=>{resize.disconnect();cancelAnimationFrame(frame);editor.off('transaction',transaction);window.removeEventListener('scroll',scrolling,true);window.removeEventListener('resize',measure);document.removeEventListener('pointermove',pointer);};
  },[editor]);
  useEffect(()=>{
    if(menu?.kind!=='axis'||!comments){setActivity(null);return;}
    const table=editor.state.doc.nodeAt(menu.pos);if(!table)return;const id=ensureBlockId(editor,{pos:menu.pos,node:table});let alive=true;
    void comments.request<BlockActivityInfo|null>('?blockActivity='+encodeURIComponent(id)).then(info=>{if(alive)setActivity(info);},()=>{if(alive)setActivity(null);});return()=>{alive=false;};
  },[editor,menu?.pos,menu?.kind,comments?.identity,comments?.pageId]);
  useEffect(()=>{const cancel=(event:KeyboardEvent)=>{const gesture=press.current;if(event.key!=='Escape'||!gesture)return;event.preventDefault();event.stopImmediatePropagation();document.documentElement.classList.remove('editor-table-dragging');press.current=null;setDrag(null);if(gesture.hidden)tableDragPresentation(editor,[]);if(gesture.history.changed){undo(editor.state,tr=>editor.view.dispatch(tr));editor.view.dispatch(closeHistory(editor.state.tr));}};window.addEventListener('keydown',cancel,true);return()=>window.removeEventListener('keydown',cancel,true);},[editor]);
  const menuAnchor=useMemo(()=>menu?{getBoundingClientRect:()=>{const g=current.current;if(!g||g.pos!==menu.pos)return menu.rect;if(menu.kind==='cells'&&g.selection)return new DOMRect(g.selection.right-10,g.selection.top+g.selection.height/2-12,20,24);const row=g.rows[menu.index],col=g.cols[menu.index];return menu.axis==='row'&&row?new DOMRect(g.rect.left-12,row.top+(row.height-28)/2,24,28):col?new DOMRect((col.left+col.right)/2-14,g.rect.top-12,28,24):menu.rect;},focus:()=>editor.view.focus()}:null,[menu,editor]);
  if(!geometry||!press.current&&!menu&&!drag&&(editorControlsBlocked(editor)||!visible&&!hover.current&&!selectedCells(editor.state)))return null;
  const g=geometry,row=g.rows[g.row],col=g.cols[g.col];if(!row||!col||g.rect.bottom<g.clip.top||g.rect.top>g.clip.bottom)return null;
  const close=()=>{setColorAnchor(null);setMenu(null);};
  const down=(event:ReactPointerEvent<HTMLButtonElement>,axis:TableAxis,index:number,edge=false,both=false)=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    const tableNode=editor.state.doc.nodeAt(g.pos)!;let range=tableAxisRange(tableNode,axis,index);const selected=selectedCells(editor.state);
    if(selected?.tablePos===g.pos){const map=TableMap.get(tableNode),sameAxis=axis==='row'?selected.rect.left===0&&selected.rect.right===map.width:selected.rect.top===0&&selected.rect.bottom===map.height;const start=axis==='row'?selected.rect.top:selected.rect.left,end=axis==='row'?selected.rect.bottom:selected.rect.right;if(sameAxis&&index>=start&&index<end&&end-start>1)range=tableAxisRange(tableNode,axis,start,end);}
    const domNode=editor.view.nodeDOM(g.pos),dom=domNode instanceof HTMLElement?domNode.querySelector('table'):null;
    let html='',width=g.rect.width,height=g.rect.height,sourceLeft=g.rect.left,sourceTop=g.rect.top;const cells=Array.from(new Set(Array.from({length:range.end-range.start},(_,i)=>axisCells(tableNode,axis,range.start+i)).flat())).map(offset=>g.pos+1+offset);
    if(dom&&!edge){const clone=dom.cloneNode(true) as HTMLTableElement;clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));clone.querySelectorAll('.selectedCell').forEach(el=>el.classList.remove('selectedCell'));
      Array.from(clone.querySelectorAll('col')).forEach((col,i)=>{col.style.width=(g.cols[i].right-g.cols[i].left)+'px';if(axis==='column'&&(i<range.start||i>=range.end))col.remove();});
      if(axis==='row'){Array.from(clone.rows).forEach((row,i)=>{if(i<range.start||i>=range.end)row.remove();});sourceTop=g.rows[range.start].top;height=g.rows[range.end-1].bottom-sourceTop;}
      else{Array.from(clone.rows).forEach((row,ri)=>{const map=TableMap.get(tableNode);let rowOffset=0;for(let r=0;r<ri;r++)rowOffset+=tableNode.child(r).nodeSize;let cellOffset=0;Array.from(row.cells).forEach((cell,ci)=>{const node=tableNode.child(ri).child(ci);const area=map.findCell(rowOffset+1+cellOffset);cellOffset+=node.nodeSize;if(area.left<range.start||area.right>range.end)cell.remove();});});sourceLeft=g.cols[range.start].left;width=g.cols[range.end-1].right-sourceLeft;}
      clone.style.width=width+'px';clone.style.minWidth=width+'px';html=clone.outerHTML;
    }
    press.current={button:event.currentTarget,pointerId:event.pointerId,anchor:event.currentTarget.getBoundingClientRect(),axis,index,x:event.clientX,y:event.clientY,to:index,boundary:index,range,hidden:false,cells,started:false,edge,both,size:{rows:g.rows.length,cols:g.cols.length},unit:{row:g.rect.height/g.rows.length,column:g.rect.width/g.cols.length},history:{time:Date.now(),changed:false},html,width,height,offset:{x:event.clientX-sourceLeft,y:event.clientY-sourceTop}};
  };
  const moving=(event:PointerEvent)=>{
    const pending=press.current,live=current.current;if(!pending||!live)return;
    if(!pending.started&&Math.hypot(event.clientX-pending.x,event.clientY-pending.y)>5){pending.started=true;document.documentElement.classList.add('editor-table-dragging');document.dispatchEvent(new Event('relay:table-drag-start'));}if(!pending.started)return;
    if(pending.edge){
      const rows=Math.max(1,Math.min(100,pending.size.rows+Math.round((event.clientY-pending.y)/pending.unit.row))),cols=Math.max(1,Math.min(50,pending.size.cols+Math.round((event.clientX-pending.x)/pending.unit.column)));
      if(pending.both||pending.axis==='row')resizeTable(editor,live.pos,'row',rows,pending.history);
      if(pending.both||pending.axis==='column')resizeTable(editor,live.pos,'column',cols,pending.history);
    }else{
      if(!pending.hidden){pending.hidden=true;tableDragPresentation(editor,pending.cells);}
      const measures=pending.axis==='row'?live.rows.map(rect=>({start:rect.top,end:rect.bottom})):live.cols.map(rect=>({start:rect.left,end:rect.right})),point=pending.axis==='row'?event.clientY:event.clientX;
      let boundary=measures.findIndex(rect=>point<(rect.start+rect.end)/2);if(boundary<0)boundary=measures.length;
      pending.boundary=boundary;pending.to=boundary;
    }
    const point=tableDragPosition(pending.axis,live.rect,{left:live.rect.left,top:live.rect.top,width:pending.width,height:pending.height},{x:event.clientX,y:event.clientY},pending.offset);
    setDrag({axis:pending.axis,index:pending.index,to:pending.to,...point,html:pending.html,width:pending.width,height:pending.height});
  };
  const finish=(cancel=false)=>{document.documentElement.classList.remove('editor-table-dragging');const pending=press.current;press.current=null;setDrag(null);if(pending?.hidden)tableDragPresentation(editor,[]);if(pending?.history.changed){if(cancel)undo(editor.state,tr=>editor.view.dispatch(tr));editor.view.dispatch(closeHistory(editor.state.tr));}return pending;};
  const up=(event:PointerEvent)=>{
    const pending=finish();if(!pending)return;
    if(pending.edge){if(!pending.started&&!pending.both)resizeTable(editor,g.pos,pending.axis,(pending.axis==='row'?g.rows.length:g.cols.length)+1);return;}
    if(pending.started){moveTableRange(editor,g.pos,pending.axis,pending.range.start,pending.range.end,pending.boundary);editor.view.focus();return;}
    let state=selectAxis(editor.state,g.pos,pending.axis,pending.index);if(!state)return;if(event.shiftKey){const current=selectedCells(editor.state);if(current?.tablePos===g.pos){const map=TableMap.get(current.table),start=Math.min(pending.index,pending.axis==='row'?current.rect.top:current.rect.left),end=Math.max(pending.index+1,pending.axis==='row'?current.rect.bottom:current.rect.right),first=pending.axis==='row'?map.map[start*map.width]:map.map[start],last=pending.axis==='row'?map.map[end*map.width-1]:map.map[(map.height-1)*map.width+end-1];state=editor.state.apply(editor.state.tr.setSelection(pending.axis==='row'?CellSelection.rowSelection(editor.state.doc.resolve(g.pos+1+first),editor.state.doc.resolve(g.pos+1+last)):CellSelection.colSelection(editor.state.doc.resolve(g.pos+1+first),editor.state.doc.resolve(g.pos+1+last))));}}bookmark.current=state.selection.getBookmark();editor.view.dispatch(editor.state.tr.setSelection(state.selection));setQuery('');setMenu({kind:'axis',pos:g.pos,axis:pending.axis,index:pending.index,rect:pending.anchor});
  };
  handlers.current={move:moving,up,cancel:()=>finish(true)};
  const pointerProps={draggable:false,onDragStart:(event:React.DragEvent)=>event.preventDefault(),onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();finish(true);}}};
  const local=(style:{left?:number;top?:number;[key:string]:unknown})=>({...style,left:style.left===undefined?undefined:style.left-g.origin.left,top:style.top===undefined?undefined:style.top-g.origin.top});
  const context=bookmark.current?selectedCells(editor.state,bookmark.current):null;
  const table=editor.state.doc.nodeAt(g.pos),header=Boolean(menu?.kind==='axis'&&table?.type.name==='table'&&axisCells(table,menu.axis,menu.index).every(pos=>table.nodeAt(pos)!.type.name==='tableHeader'));
  const actions:AxisAction[]=['insertBefore','insertAfter','duplicate','moveBefore','moveAfter','clearContents','delete'];
  const label=(action:AxisAction)=>t(action==='header'?(menu?.axis==='row'?'headerRow':'headerColumn'):action==='insertBefore'?(menu?.axis==='row'?'insertAbove':'insertLeft'):action==='insertAfter'?(menu?.axis==='row'?'insertBelow':'insertRight'):action);
  const colorButton=<button type="button" className="rich-menu-row" onMouseEnter={event=>setColorAnchor(event.currentTarget)} onClick={event=>setColorAnchor(event.currentTarget)} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();setColorAnchor(event.currentTarget);}}}><BlockGlyph type="color"/><span>{labels('actions.color')}</span><BlockGlyph type="chevronRight"/></button>;
  return <>{createPortal(<div className="rich-table-controls" data-editor-control data-dragging={Boolean(drag&&!press.current?.edge)}>
    {(press.current?.axis==='row'&&!press.current.edge||g.rect.left>=g.clip.left&&row.top>=g.clip.top&&row.bottom<=g.clip.bottom)?<button type="button" className="rich-table-grip" data-editor-menu-owner={owner} style={local({left:g.rect.left-9,top:row.top+(row.height-26)/2})} aria-label={t('row')} data-editor-tooltip={t('row')} onPointerDown={event=>down(event,'row',g.row)} {...pointerProps}><BlockGlyph type="grip"/></button>:null}
    {(press.current?.axis==='column'&&!press.current.edge||g.rect.top>=g.clip.top&&col.right>g.clip.left&&col.left<g.clip.right)?<button type="button" className="rich-table-grip rich-table-col-grip" data-editor-menu-owner={owner} style={local({left:Math.max(g.clip.left,Math.min((col.left+col.right)/2-13,g.clip.right-26)),top:g.rect.top-9})} aria-label={t('column')} data-editor-tooltip={t('column')} onPointerDown={event=>down(event,'column',g.col)} {...pointerProps}><BlockGlyph type="grip"/></button>:null}
    {!menu&&g.selection&&g.selection.right<=g.clip.right+1&&g.selection.top<g.clip.bottom&&g.selection.bottom>g.clip.top?<><div className="rich-table-cell-outline" style={local({left:g.selection.left,top:g.selection.top,width:g.selection.width,height:g.selection.height})}/><button type="button" className="rich-table-grip rich-table-cell-grip" data-editor-menu-owner={owner} style={local({left:g.selection.right-6,top:g.selection.top+(g.selection.height-22)/2})} aria-label={t('cellOptions')} data-editor-tooltip={t('cellOptions')} onPointerDown={event=>event.preventDefault()} onClick={event=>{const selected=selectedCells(editor.state);if(!selected)return;bookmark.current=selected.bookmark;editor.view.dispatch(editor.state.tr.setSelection(selected.state.selection));setMenu({kind:'cells',pos:g.pos,axis:'row',index:0,rect:event.currentTarget.getBoundingClientRect()});}}><BlockGlyph type="cellGrip"/></button></>:null}
    {!menu&&(press.current?.edge&&press.current.axis==='row'&&!press.current.both||edges.bottom&&g.rect.bottom<g.clip.bottom-24)?<button type="button" className="rich-table-add rich-table-add-row" style={local({left:Math.max(g.clip.left,g.rect.left),top:g.rect.bottom+3,width:Math.min(g.clip.right,g.rect.right)-Math.max(g.clip.left,g.rect.left)})} aria-label={t('addRow')} data-editor-tooltip={t('addRowHelp')} data-tooltip-placement="below" onPointerDown={event=>down(event,'row',g.rows.length,true)} {...pointerProps}><BlockGlyph type="add"/></button>:null}
    {!menu&&(press.current?.edge&&press.current.axis==='column'&&!press.current.both||edges.right&&g.rect.right+5<g.clip.right&&g.rect.right+24>g.clip.left)?<button type="button" className="rich-table-add rich-table-add-col" style={local({left:g.rect.right+5,top:Math.max(g.rect.top,g.clip.top),height:Math.min(g.rect.bottom,g.clip.bottom)-Math.max(g.rect.top,g.clip.top),clipPath:`inset(0 ${Math.max(0,g.rect.right+24-g.clip.right)}px 0 ${Math.max(0,g.clip.left-g.rect.right-5)}px)`})} aria-label={t('addColumn')} data-editor-tooltip={t('addColumnHelp')} data-tooltip-placement="below" data-tooltip-anchor="bottom" onPointerDown={event=>down(event,'column',g.cols.length,true)} {...pointerProps}><BlockGlyph type="add"/></button>:null}
    {!menu&&(edges.corner||press.current?.both)?<button type="button" className="rich-table-corner" aria-label={t('resizeTable')} data-editor-tooltip={t('resizeTable')} data-tooltip-placement="below" style={local({left:g.rect.right-12,top:g.rect.bottom-12})} onPointerDown={event=>down(event,'row',g.rows.length,true,true)} {...pointerProps}/>:null}
  </div>,editor.view.dom.closest<HTMLElement>('.relay-editor')!)}
  {drag?createPortal(press.current?.edge?<TableSizeTooltip button={press.current.button} rows={g.rows.length} columns={g.cols.length}/>:<div className="rich-table-drag-copy relay-editor" style={{position:'fixed',left:0,top:0,transform:`translate3d(${drag.x}px,${drag.y}px,0)`,width:drag.width,height:drag.height,maxWidth:'none',margin:0}}><div className="rich-table-drag-surface"><div className="tiptap" dangerouslySetInnerHTML={{__html:drag.html??''}}/></div><span className="rich-table-drag-handle" data-axis={drag.axis} style={{left:press.current?press.current.anchor.left-(press.current.x-press.current.offset.x):0,top:press.current?press.current.anchor.top-(press.current.y-press.current.offset.y):0}}><BlockGlyph type="grip"/></span></div>,document.body):null}
  {drag&&!press.current?.edge&&press.current?createPortal(<div className="rich-table-drop" style={drag.axis==='row'?{left:Math.max(g.clip.left,g.rect.left),width:Math.min(g.clip.right,g.rect.right)-Math.max(g.clip.left,g.rect.left),top:g.rows[press.current.boundary]?.top??g.rect.bottom,height:2}:{left:g.cols[press.current.boundary]?.left??g.rect.right,top:g.rect.top,width:2,height:g.rect.height}}/>,document.body):null}
  {menu&&menuAnchor?<RichPopover anchor={menuAnchor} owner={owner} side={menu.kind==='cells'||menu.axis==='row'?'right':'bottom'} align="start" label={t(menu.kind==='cells'?'cellOptions':menu.axis)} onClose={close} className="rich-table-menu" width={288}>
    {menu.kind==='axis'?<input autoFocus className="rich-menu-search" aria-label={labels('searchActions')} placeholder={labels('searchActions')} value={query} onChange={event=>setQuery(event.target.value)}/>:null}
    <OverlayScroll className="rich-table-menu-scroll" fitContent>{menu.kind==='axis'&&(!query||label('header').toLowerCase().includes(query.toLowerCase()))?<button type="button" className="rich-menu-row" onClick={()=>runAxisAction(editor,g.pos,menu.axis,menu.index,'header')}><BlockGlyph type={menu.axis==='row'?'headerRow':'headerColumn'}/><span>{label('header')}</span><span className="rich-menu-switch" data-checked={header}/></button>:null}{(!query||labels('actions.color').toLowerCase().includes(query.toLowerCase()))?colorButton:null}
    {menu.kind==='axis'?actions.filter(action=>canAxisAction(editor.state,g.pos,menu.axis,menu.index,action)&&label(action).toLowerCase().includes(query.toLowerCase())).map(action=><button type="button" className="rich-menu-row" data-danger={action==='delete'} key={action} onMouseEnter={()=>setColorAnchor(null)} onClick={()=>{runAxisAction(editor,g.pos,menu.axis,menu.index,action);close();editor.commands.focus();}}><BlockGlyph type={action==='insertBefore'||action==='moveBefore'?(menu.axis==='row'?'up':'left'):action==='insertAfter'||action==='moveAfter'?(menu.axis==='row'?'down':'right'):action==='header'?'table':action==='clearContents'?'clearContents':action}/><span>{label(action)}</span>{action==='header'?<span className="rich-menu-switch" data-checked={header}/>:null}</button>):<>{(['mergeCells','splitCell'] as const).filter(action=>bookmark.current&&canCellAction(editor.state,bookmark.current,action)).map(action=><button type="button" className="rich-menu-row" key={action} onMouseEnter={()=>setColorAnchor(null)} onClick={()=>{if(bookmark.current)runCellAction(editor,bookmark.current,action);close();editor.commands.focus();}}><BlockGlyph type={action}/><span>{labels(`actions.${action}`)}</span></button>)}{onComment&&context?.cells.some(({node})=>node.textContent)?<button type="button" className="rich-menu-row" onClick={()=>{if(context)onComment({pos:context.tablePos,node:context.table},context.cells.map(({node})=>node.textContent).join(' · '));close();}}><BlockGlyph type="comment"/><span>{labels('actions.comment')}</span></button>:null}{bookmark.current&&canCellAction(editor.state,bookmark.current,'clearContents')?<button type="button" className="rich-menu-row" onClick={()=>{if(bookmark.current)runCellAction(editor,bookmark.current,'clearContents');close();editor.commands.focus();}}><BlockGlyph type="clearContents"/><span>{t('clearContents')}</span></button>:null}</>}
    </OverlayScroll>{menu.kind==='axis'&&comments?<BlockActivityFooter info={activity} people={people} owner={owner}/>:null}
  </RichPopover>:null}
  {menu&&colorAnchor&&bookmark.current?<BlockColorMenu anchor={colorAnchor} owner={owner} text={context?.cells[0]?.node.attrs.cellTextColor} background={context?.cells[0]?.node.attrs.cellBackground} onClose={()=>setColorAnchor(null)} onPick={(kind,value)=>{if(bookmark.current)colorTableCells(editor,bookmark.current,kind,value);}}/>:null}
  </>;
}
