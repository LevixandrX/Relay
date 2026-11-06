import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import {NodeSelection} from '@tiptap/pm/state';
import { editorCanvas } from "./use-editor-canvas";
import { editorClipRect } from "./use-block-handles";
import { packCommentStacks, avoidCommentObstacles } from "./comment-layout";
import {commentRow} from './comment-rows';

export type CommentPlacement = { key: string; left: number; top: number; width: number };
export type CommentIndicator = { blockId: string; blockIds:string[]; left: number; top: number };
function editingTable(editor:Editor){
  if(!editor.view.hasFocus())return null;
  const selection=editor.state.selection;if(selection instanceof NodeSelection&&selection.node.type.name==='table')return selection.from;
  for(let d=selection.$from.depth;d>0;d--)if(selection.$from.node(d).type.name==='table')return selection.$from.before(d);
  return null;
}
export function useCommentLayout(editor: Editor, layer: RefObject<HTMLDivElement | null>, cards: { key: string; blockId: string; anchorId: string; first?: boolean }[], active: string | null) {
  const [revision, setRevision] = useState(0);
  const [layout, setLayout] = useState<{ placements: CommentPlacement[]; spaces: { pos: number; height: number }[]; compact: boolean; indicators: CommentIndicator[] }>({ placements: [], spaces: [], compact: false, indicators: [] });
  const frame = useRef(0);
  const measure = useCallback(() => { if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;setRevision((r)=>r+1);}); }, []);
  const measureCard=measure;
  useEffect(() => {
    const observer = new ResizeObserver(measure); observer.observe(editor.view.dom); observer.observe(editorCanvas(editor));
    const appearance = new MutationObserver(measure); appearance.observe(document.documentElement, {attributes:true,attributeFilter:['data-chrome','style']});
    let table=editingTable(editor);
    const focus=()=>{const next=editingTable(editor);if(next!==table){table=next;measure();}};
    const blur=()=>{table=null;measure();};
    const transaction=({transaction}:{transaction:Transaction})=>{if(transaction.docChanged||transaction.getMeta('relay:comment-layout'))measure();else if(transaction.selectionSet)focus();};
    editor.view.dom.addEventListener('focusin',focus);editor.view.dom.addEventListener('focusout',blur);
    editor.on("transaction", transaction); window.addEventListener("resize", measure);editor.view.dom.addEventListener('relay:row-layout',measure);editor.view.dom.addEventListener('relay:table-layout',measure);
    return () => { observer.disconnect(); appearance.disconnect(); cancelAnimationFrame(frame.current); frame.current=0; editor.off("transaction", transaction);editor.view.dom.removeEventListener('focusin',focus);editor.view.dom.removeEventListener('focusout',blur); window.removeEventListener("resize", measure);editor.view.dom.removeEventListener('relay:row-layout',measure);editor.view.dom.removeEventListener('relay:table-layout',measure); };
  }, [editor, measure]);
  useLayoutEffect(() => {
    const host = editor.view.dom.closest<HTMLElement>('.relay-editor');
    if (!host) return;
    const origin = host.getBoundingClientRect(), text = editor.view.dom.getBoundingClientRect();
    const hostStyle=getComputedStyle(host);
    const gap = parseFloat(hostStyle.getPropertyValue('--comment-card-gap')) || 112;
    const side = host.dataset.annotationsSide==='true';
    if (!side) {
      const indicators: CommentIndicator[] = [];
      const seen=new Set<string>();
      for (const blockId of new Set(cards.map(card=>card.blockId))) {
        const row=commentRow(editor,blockId);
        if(!row.element||seen.has(row.blockId))continue;
        seen.add(row.blockId);
        const rect=row.element.getBoundingClientRect();
        const edge=row.element.matches('.relay-columns')?rect.right:text.right;
        indicators.push({blockId:row.blockId,blockIds:row.blockIds,left:edge-origin.left+20,top:rect.top-origin.top});
      }
      host.style.setProperty('--comment-bottom-space','0px');
      const next={placements:[],spaces:[],compact:true,indicators};
      setLayout(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
      return;
    }
    const preferred = parseFloat(hostStyle.getPropertyValue('--comment-card-width')) || 328;
    const width = preferred;
    const clip = editorClipRect(editor);
    const maxHeight = `${Math.max(120, Math.min(560, clip.bottom - clip.top - 32))}px`;
    if (host.style.getPropertyValue('--comment-card-max-height') !== maxHeight) host.style.setProperty('--comment-card-max-height', maxHeight);
    layer.current?.style.setProperty('--comment-card-max-height',maxHeight);
    const groups = new Map<HTMLElement, { card: typeof cards[number]; desired: number; height: number }[]>();
    const blocks=new Map(Array.from(editor.view.dom.querySelectorAll<HTMLElement>('[data-block-id]'),el=>[el.dataset.blockId!,el]));
    const anchors=new Map<string,HTMLElement>();for(const el of editor.view.dom.querySelectorAll<HTMLElement>('[data-comment-anchor-id]'))if(!anchors.has(el.dataset.commentAnchorId!))anchors.set(el.dataset.commentAnchorId!,el);
    const cardElements=new Map(Array.from(layer.current?.querySelectorAll<HTMLElement>('[data-comment-card]')??[],el=>[el.dataset.commentCard!,el]));
    const occupied=Array.from(editor.view.dom.querySelectorAll<HTMLElement>('.relay-columns,.tableWrapper'));
    const columnRects=occupied.map(el=>{const r=el.querySelector('table')?.getBoundingClientRect()??el.getBoundingClientRect(),wrap=el.getBoundingClientRect();return new DOMRect(r.left,r.top,r.width,Math.max(r.bottom,wrap.bottom)-r.top);});
    for (const card of cards) {
      const block = blocks.get(card.blockId);
      const row = block || editor.view.dom;
      const anchor = anchors.get(card.anchorId);
      const element = cardElements.get(card.key);
      const content = element?.querySelector<HTMLElement>('.editor-comment-card-content');
      const style = element && getComputedStyle(element);
      // Measure final content geometry, never a halfway height from the animation.
      const height = Number(element?.dataset.layoutHeight) || (content && style ? content.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) : (card.first ? 42 : 88));
      const line = (anchor ?? block)?.getClientRects()[0];
      const lineHeight = line ? Math.min(line.height, parseFloat(getComputedStyle(anchor ?? block!).lineHeight) || 27) : 0;
      const desired = (line ? line.top + lineHeight/2 : text.bottom + 16) - origin.top - (card.first ? 19 : 25);
      groups.set(row, [...(groups.get(row) ?? []), { card, desired, height }]);
    }
    const placements: CommentPlacement[] = [], spaces: { pos: number; height: number }[] = [];
    const sorted = [...groups].sort((a,b) => a[1][0].desired - b[1][0].desired);
    const packed = packCommentStacks(sorted.map(([,items]) => ({ desired: items[0].desired, items: items.map((item) => ({key:item.card.key,height:item.height})) })), active);
    const heights=new Map([...groups.values()].flat().map(item=>[item.card.key,item.height]));
    const obstacles=columnRects.filter(rect=>rect.left<text.right+gap+width+8&&rect.right>text.right+gap-8).map(rect=>({top:rect.top-origin.top-8,bottom:rect.bottom-origin.top+16}));
    const safe=avoidCommentObstacles(packed.map(item=>({...item,height:heights.get(item.key)!})),obstacles,active);
    const packedPositions=new Map(safe.map(item=>[item.key,item.top]));
    let end = 0;
    for (const [, items] of sorted) {
      let start = 0;
      const left = text.right + gap - origin.left;
      for (const item of items) { const top = packedPositions.get(item.card.key)!; placements.push({ key: item.card.key, left, top, width }); start = top + item.height + 12; }
      end = Math.max(end, start);
    }
    const bottom = Math.max(0, end - (text.bottom - origin.top + 32));
    const extra = `${Math.ceil(bottom)}px`;
    if (host.style.getPropertyValue("--comment-bottom-space") !== extra) host.style.setProperty("--comment-bottom-space", extra);
    const next = { placements, spaces, compact:false, indicators:[] };
    setLayout((old) => JSON.stringify(old) === JSON.stringify(next) ? old : next);
  },[editor,layer,cards,active,revision]);
  // Geometry is relative to the document; scrolling never pins cards to the viewport.
  useEffect(() => { const host=editor.view.dom.closest<HTMLElement>('.relay-editor'); return () => { host?.style.removeProperty("--comment-bottom-space"); host?.style.removeProperty('--comment-card-max-height'); }; }, [editor]);
  return { ...layout, measure:measureCard };
}
