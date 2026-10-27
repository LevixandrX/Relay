import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { editorCanvas } from "./use-editor-canvas";
import { editorClipRect } from "./use-block-handles";
import { packCommentStacks } from "./comment-layout";
import {commentRow} from './comment-rows';

export type CommentPlacement = { key: string; left: number; top: number; width: number };
export type CommentIndicator = { blockId: string; blockIds:string[]; left: number; top: number };
export function useCommentLayout(editor: Editor, layer: RefObject<HTMLDivElement | null>, cards: { key: string; blockId: string; anchorId: string; first?: boolean }[], active: string | null) {
  const [revision, setRevision] = useState(0);
  const [layout, setLayout] = useState<{ placements: CommentPlacement[]; spaces: { pos: number; height: number }[]; compact: boolean; indicators: CommentIndicator[] }>({ placements: [], spaces: [], compact: false, indicators: [] });
  const frame = useRef(0);
  const measure = useCallback(() => { if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;setRevision((r)=>r+1);}); }, []);
  const measureCard=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(() => {
    const observer = new ResizeObserver(measure); observer.observe(editor.view.dom); observer.observe(editorCanvas(editor));
    const appearance = new MutationObserver(measure); appearance.observe(document.documentElement, {attributes:true,attributeFilter:['data-chrome','style']});
    const transaction=({transaction}:{transaction:Transaction})=>{if(transaction.docChanged||transaction.getMeta('relay:comment-layout'))measure();};
    editor.on("transaction", transaction); window.addEventListener("resize", measure);editor.view.dom.addEventListener('relay:row-layout',measure);
    return () => { observer.disconnect(); appearance.disconnect(); cancelAnimationFrame(frame.current); frame.current=0; editor.off("transaction", transaction); window.removeEventListener("resize", measure);editor.view.dom.removeEventListener('relay:row-layout',measure); };
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
    for (const card of cards) {
      const block = editor.view.dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(card.blockId)}"]`);
      const row = block || editor.view.dom;
      const anchor = editor.view.dom.querySelector<HTMLElement>(`[data-comment-anchor-id="${CSS.escape(card.anchorId)}"]`);
      const element = layer.current?.querySelector<HTMLElement>(`[data-comment-card="${CSS.escape(card.key)}"]`);
      const content = element?.querySelector<HTMLElement>('.editor-comment-card-content');
      const style = element && getComputedStyle(element);
      // Measure final content geometry, never a halfway height from the animation.
      const height = Number(element?.dataset.layoutHeight) || (content && style ? content.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) : (card.first ? 42 : 88));
      const line = (anchor ?? block)?.getClientRects()[0];
      const lineHeight = line ? Math.min(line.height, parseFloat(getComputedStyle(anchor ?? block!).lineHeight) || 27) : 0;
      let desired = (line ? line.top + lineHeight/2 : text.bottom + 16) - origin.top - (card.first ? 19 : 25);
      if(card.key!==active){
        const left=text.right+gap,right=left+width;
        for(const columns of editor.view.dom.querySelectorAll<HTMLElement>('.relay-columns')){
          const rect=columns.getBoundingClientRect();
          if(rect.left<right+8&&rect.right>left-8&&desired+origin.top+height>rect.top-8&&desired+origin.top<rect.bottom+8)desired=rect.bottom-origin.top+16;
        }
      }
      groups.set(row, [...(groups.get(row) ?? []), { card, desired, height }]);
    }
    const placements: CommentPlacement[] = [], spaces: { pos: number; height: number }[] = [];
    const sorted = [...groups].sort((a,b) => a[1][0].desired - b[1][0].desired);
    const packed = packCommentStacks(sorted.map(([,items]) => ({ desired: items[0].desired, items: items.map((item) => ({key:item.card.key,height:item.height})) })), active);
    let end = 0;
    for (const [, items] of sorted) {
      let start = 0;
      const left = text.right + gap - origin.left;
      for (const item of items) { const top = packed.find((p)=>p.key===item.card.key)!.top; placements.push({ key: item.card.key, left, top, width }); start = top + item.height + 12; }
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
