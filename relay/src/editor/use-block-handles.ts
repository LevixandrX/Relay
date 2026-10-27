import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { ensureBlockId } from "./block-appearance";
import { editorCanvas } from "./use-editor-canvas";
import {editorControlZone,editorControlBridge,BLOCK_CONTROL_GAP,BLOCK_CONTROLS_WIDTH} from './editor-control-zones';
import {MAX_COLUMNS} from '../domain/blocks/columns';
import {editorControlsBlocked,editorControlsCovered} from './use-editor-controls';
import { sideDropAt } from "./drop-zones";
import type { DropLine } from "./DropIndicator";
import type { Editor } from "@tiptap/core";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import { blockAt, moveBlock, moveBlockBeside, listRowTarget, type BlockTarget } from "./block-commands";

type Point = { x: number; y: number };
type Line = DropLine;
type Drop = { pos: number; line: Line; beside?: { target: BlockTarget; side: "left" | "right" }; indent?: number };
type Press = { source: BlockTarget; origin: Point; point: Point; pointerId: number; button: HTMLElement; started: boolean; drop: Drop | null; preview?: { html: string; width: number; offsetY: number } };
const isItem = (target: BlockTarget) => ["listItem", "taskItem"].includes(target.node.type.name);

// Portaled controls must respect every clipping ancestor of the document
export function editorClipRect(editor: Editor) {
  const viewport = window.visualViewport;
  const bounds = { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0, right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth), bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) };
  for (let parent = editor.view.dom.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const rect = parent.getBoundingClientRect();
    if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
      bounds.top = Math.max(bounds.top, rect.top + parent.clientTop);
      bounds.bottom = Math.min(bounds.bottom, rect.top + parent.clientTop + parent.clientHeight);
    }
    if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
      bounds.left = Math.max(bounds.left, rect.left + parent.clientLeft);
      bounds.right = Math.min(bounds.right, rect.left + parent.clientLeft + parent.clientWidth);
    }
  }
  // A floating navigation pane occludes controls even though it is not an ancestor.
  for(const sidebar of document.querySelectorAll<HTMLElement>('.sidebar,.relay-sidebar')){
    const rect=sidebar.getBoundingClientRect(),style=getComputedStyle(sidebar);
    if(style.visibility!=='hidden'&&style.display!=='none'&&rect.right>bounds.left&&rect.left<=bounds.left&&rect.bottom>bounds.top&&rect.top<bounds.bottom)bounds.left=Math.min(bounds.right,rect.right);
  }
  return bounds;
}

// Align with the first text line, including code padding and indented list items
export function blockGeometry(editor: Editor, target: BlockTarget) {
  const dom = editor.view.nodeDOM(target.pos);
  if (!(dom instanceof HTMLElement)) return null;
  const rect = dom.getBoundingClientRect();
  const lineElement = dom.matches("p,h1,h2,h3") ? dom : dom.querySelector<HTMLElement>("p,h1,h2,h3") ?? dom;
  const line = lineElement.getBoundingClientRect();
  const style = getComputedStyle(lineElement);
  const padding = parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
  const lineHeight = Math.min(Math.max(0, line.height - padding), parseFloat(style.lineHeight) || 26);
  const center = line.top + padding + lineHeight / 2;
  const paintInset=parseFloat(getComputedStyle(dom,'::after').left)||0;
  const hitRect=isItem(target)?new DOMRect(rect.x,rect.y,rect.width,Math.max(24,line.bottom-rect.top)):rect;
  const paintLeft=rect.left+paintInset,left=Math.max(editorClipRect(editor).left+2,paintLeft-BLOCK_CONTROLS_WIDTH-BLOCK_CONTROL_GAP);
  return { rect:hitRect, left, gap:Math.max(0,paintLeft-left-BLOCK_CONTROLS_WIDTH), top: center - 15 };
}

function targets(editor: Editor, items: boolean) {
  const result: { target: BlockTarget; rect: DOMRect }[] = [];
  editor.state.doc.descendants((node, pos, parent) => {
    const item = ["listItem", "taskItem"].includes(node.type.name);
    if (!["doc","column"].includes(parent?.type.name ?? "") && !(items && item)) return !node.isTextblock;
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) result.push({ target: { pos, node, parentType: parent?.type.name }, rect: dom.getBoundingClientRect() });
    return !node.isTextblock;
  });
  return result;
}

function nearest(editor: Editor, point: Point, items: boolean, drop = false) {
  const rows = targets(editor, items).map(row=>{
    if(drop||!isItem(row.target))return row;
    const dom=editor.view.nodeDOM(row.target.pos),line=dom instanceof HTMLElement?dom.querySelector('p,h1,h2,h3')?.getBoundingClientRect():null;
    return line?{...row,rect:new DOMRect(row.rect.x,row.rect.y,row.rect.width,Math.max(24,line.bottom-row.rect.top))}:row;
  }).filter((row) => (drop||!items||!['bulletList','orderedList','taskList'].includes(row.target.node.type.name))&&(row.target.node.type.name !== "columns" || drop && (point.y < row.rect.top + 5 || point.y > row.rect.bottom - 5)));
  // Prefer an individual list item over its surrounding list when both contain y
  let best: typeof rows[number] | null = null;
  let bestDistance = Infinity;
  for (const row of rows) {
    const distance = Math.max(row.rect.top - point.y, point.y - row.rect.bottom, 0) + Math.max(row.rect.left - point.x, point.x - row.rect.right, 0) * .4;
    if (distance < bestDistance || (distance === bestDistance && row.rect.height < (best?.rect.height ?? Infinity))) {
      best = row; bestDistance = distance;
    }
  }
  return best;
}

export function useBlockHandles(editor: Editor, container: RefObject<HTMLDivElement | null>, handles: RefObject<HTMLDivElement | null>, editable: boolean, locked: boolean, onOpen: (target: BlockTarget) => void, onDrag: () => void) {
  const [target, setTarget] = useState<BlockTarget | null>(null);
  const [dropLine, setDropLine] = useState<Line | null>(null);
  const [ghost, setGhost] = useState<{ left: number; top: number; html: string; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, reposition] = useState(0);
  const targetRef = useRef<BlockTarget | null>(null);
  const press = useRef<Press | null>(null);
  const callbacks = useRef({ locked, onOpen, onDrag });
  callbacks.current = { locked, onOpen, onDrag };
  const selectTarget = useCallback((next: BlockTarget | null) => {
    const selection=editor.state.selection;
    if(next&&selection instanceof NodeSelection&&selection.node.isTextblock){const row=listRowTarget(editor,next);if(row?.pos===selection.from)next=row;}
    if (targetRef.current?.pos === next?.pos && targetRef.current?.node === next?.node) return;
    targetRef.current = next;
    setTarget(next);
  }, [editor]);

  useEffect(() => {
    if (!editable) { selectTarget(null); return; }
    let hideTimer = 0, frame = 0, lastTime = 0;
    let hoveredColumns: HTMLElement | null = null;
    const controlHover = (active: BlockTarget | null) => {
      const dom=active?editor.view.nodeDOM(active.pos):null;
      const group=dom instanceof HTMLElement?dom.closest<HTMLElement>('.relay-columns'):null;
      if(group===hoveredColumns)return;
      if(hoveredColumns)delete hoveredColumns.dataset.controlsHovered;
      hoveredColumns=group;
      if(group)group.dataset.controlsHovered='true';
    };
    const cancelHide = () => { window.clearTimeout(hideTimer); hideTimer = 0; };
    const hide = () => { if (!hideTimer) hideTimer = window.setTimeout(() => { hideTimer = 0; selectTarget(null); }, 140); };
    const finish = (commit: boolean) => {
      const pending = press.current;
      if (!pending) return;
      press.current = null;
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("editor-block-dragging");
      if (pending.button.hasPointerCapture(pending.pointerId)) pending.button.releasePointerCapture(pending.pointerId);
      setDragging(false); setDropLine(null); setGhost(null);
      if (pending.started && commit && pending.drop) {
        if (pending.drop.beside) moveBlockBeside(editor,pending.source,pending.drop.beside.target,pending.drop.beside.side);
        else moveBlock(editor, pending.source, pending.drop.pos,pending.drop.indent);
      }
      else if (!pending.started && commit) callbacks.current.onOpen(pending.source);
    };
    const updateDrop = () => {
      const pending = press.current;
      if (!pending?.started) return;
      // Side drops intentionally live outside the text measure. Use the work
      // surface, rather than the narrow editor wrapper, as the drop boundary.
      const viewport = container.current?.closest<HTMLElement>(".overlay-scroll-target") ?? editorCanvas(editor);
      const bounds = viewport?.getBoundingClientRect();
      const point = pending.point;
      if (!bounds || point.x < bounds.left + 4 || point.x > bounds.right - 4 || point.y < bounds.top || point.y > bounds.bottom) {
        pending.drop = null; setDropLine(null); return;
      }
      const row = nearest(editor, point, isItem(pending.source),true);
      if (!row) { pending.drop = null; setDropLine(null); return; }
      const clip = editorClipRect(editor);
      const sourceEnd = pending.source.pos + pending.source.node.nodeSize;
      const overlaps = row.target.pos >= pending.source.pos && row.target.pos < sourceEnd || pending.source.pos >= row.target.pos && pending.source.pos < row.target.pos + row.target.node.nodeSize;
      const atSide = point.y >= row.rect.top + Math.min(5,row.rect.height*.2) && point.y <= row.rect.bottom - Math.min(5,row.rect.height*.2);
      const previousSide = pending.drop?.beside?.target.pos === row.target.pos ? pending.drop.beside.side : undefined;
      const resolved = editor.state.doc.resolve(row.target.pos);
      const group = resolved.parent.type.name === "column" && resolved.depth >= 2 ? resolved.node(resolved.depth-1) : null;
      const columnDOM=group?editor.view.nodeDOM(resolved.before()):null;
      const columnGap=columnDOM instanceof HTMLElement&&columnDOM.parentElement?parseFloat(getComputedStyle(columnDOM.parentElement).columnGap)||24:40;
      const side = sideDropAt(point.x, row.rect.left, row.rect.right, previousSide,group?Math.min(20,columnGap/2-2):20);
      if (!overlaps && atSide && side && !["columns","listItem","taskItem"].includes(row.target.node.type.name) && (!group || group.childCount < MAX_COLUMNS)) {
        const rect = group ? (editor.view.nodeDOM(resolved.before()) as HTMLElement)?.getBoundingClientRect() ?? row.rect : row.rect;
        const top = Math.max(clip.top+4,rect.top-4), bottom = Math.min(clip.bottom-4,rect.bottom+4);
        const left = Math.max(clip.left+4,Math.min(clip.right-4,(side === "left" ? rect.left-7 : rect.right+7)));
        if(bottom > top) { const line: Line={left:left-1.5,top,width:3,height:bottom-top,axis:"vertical"}; pending.drop={pos:row.target.pos,line,beside:{target:row.target,side}}; setDropLine(line); return; }
      }
      const after = point.y > (row.rect.top + row.rect.bottom) / 2;
      const pos = after ? row.target.pos + row.target.node.nodeSize : row.target.pos;
      if (pos >= pending.source.pos && pos <= pending.source.pos + pending.source.node.nodeSize) {
        pending.drop = null; setDropLine(null); return;
      }
      const before = editor.state.doc.resolve(pos).nodeBefore;
      const previousDOM = before ? editor.view.nodeDOM(pos - before.nodeSize) : null;
      const nextDOM = editor.view.nodeDOM(pos);
      const previousRect = previousDOM instanceof HTMLElement ? previousDOM.getBoundingClientRect() : null;
      const nextRect = nextDOM instanceof HTMLElement ? nextDOM.getBoundingClientRect() : null;
      const boundary = after ? row.rect.bottom + 4 : row.rect.top - 4;
      const gap = previousRect && nextRect ? nextRect.top - previousRect.bottom : 0;
      const top = previousRect && nextRect && gap >= 0 && gap < 40 ? (previousRect.bottom + nextRect.top) / 2 : boundary;
      if (top < clip.top + 6 || top > clip.bottom - 6) { pending.drop = null; setDropLine(null); return; }
      const parentDOM = row.target.parentType === "column" ? (editor.view.nodeDOM(resolved.before()) as HTMLElement) : editor.view.dom;
      const parentRect = parentDOM.getBoundingClientRect();
      const maxIndent = Math.max(0,Math.min(8,Math.floor((parentRect.width - 140)/24)));
      const indent = isItem(pending.source) || row.target.node.type.name === "columns" ? undefined : Math.max(0, Math.min(maxIndent,Math.round((point.x-parentRect.left-40)/24)));
      const left = Math.max(clip.left + 4, (indent === undefined ? row.rect.left : parentRect.left+indent*24) - 10);
      const right = Math.min(clip.right - 4, row.rect.right + 10);
      const line: Line = { left, top:top-1.5, width: Math.max(0, right - left),height:3,axis:"horizontal" };
      pending.drop = { pos, line, indent };
      // React may evaluate this updater after the press is finished or cancelled.
      // Capture immutable geometry, never the mutable drag session.
      setDropLine((old) => old?.axis === line.axis && old?.height === line.height && old?.left === line.left && old?.top === line.top && old?.width === line.width ? old : line);
    };
    const autoScroll = (time: number) => {
      if (!press.current?.started) return;
      let scrollport: HTMLElement | null = container.current;
      while (scrollport && !(scrollport.scrollHeight > scrollport.clientHeight && /auto|scroll/.test(getComputedStyle(scrollport).overflowY))) scrollport = scrollport.parentElement;
      scrollport ??= document.scrollingElement as HTMLElement;
      const bounds = scrollport === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scrollport.getBoundingClientRect();
      const point = press.current.point;
      const edge = 48;
      const delta = point.y < bounds.top + edge ? -Math.min(1, (bounds.top + edge - point.y) / edge) : point.y > bounds.bottom - edge ? Math.min(1, (point.y - bounds.bottom + edge) / edge) : 0;
      const elapsed = Math.min(32, time - (lastTime || time)); lastTime = time;
      if (delta) { scrollport.scrollTop += delta * elapsed * .65; updateDrop(); }
      frame = requestAnimationFrame(autoScroll);
    };
    const moved = (event: PointerEvent) => {
      const pending = press.current;
      if (pending) {
        if (event.pointerId !== pending.pointerId) return;
        event.preventDefault();
        pending.point = { x: event.clientX, y: event.clientY };
        if (!pending.started && Math.hypot(pending.point.x - pending.origin.x, pending.point.y - pending.origin.y) >= 5) {
          pending.started = true; callbacks.current.onDrag();
          editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pending.source.pos)));
          setDragging(true);
          document.documentElement.classList.add("editor-block-dragging");
          lastTime = 0; frame = requestAnimationFrame(autoScroll);
        }
        if (pending.started) {
          if (!pending.preview) {
            const dom = editor.view.nodeDOM(pending.source.pos);
            if (dom instanceof HTMLElement) {
              const clone = dom.cloneNode(true) as HTMLElement;
              clone.removeAttribute("id"); clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
              clone.classList.remove("relay-activity-focus-block", "ProseMirror-selectednode");
              // Indentation already placed the source in the document. The
              // preview starts at the pointer and must not apply it again.
              clone.removeAttribute('data-block-indent');
              clone.style.marginInlineStart='0';
              clone.style.setProperty('--block-indent','0');
              clone.style.textAlign='start';
              pending.preview = { html: clone.outerHTML, width: Math.min(440, dom.getBoundingClientRect().width), offsetY: (blockGeometry(editor,pending.source)?.top ?? dom.getBoundingClientRect().top) + 14 - dom.getBoundingClientRect().top };
            }
          }
          if (pending.preview) setGhost({ left: pending.point.x + 18, top: pending.point.y - pending.preview.offsetY, ...pending.preview });
        }
        updateDrop(); return;
      }
      if (callbacks.current.locked) return;
      if(editorControlsBlocked(editor)||editorControlsCovered({left:event.clientX,right:event.clientX+.1,top:event.clientY,bottom:event.clientY+.1})){controlHover(null);selectTarget(null);return;}
      const element = event.target instanceof Element ? event.target : null;
      if(element?.closest('.sidebar,.relay-sidebar,.shell-edge,.relay-edge-peek')){cancelHide();controlHover(null);selectTarget(null);return;}
      const active=targetRef.current, activeGeometry=active?blockGeometry(editor,active):null;
      const onControls=element&&handles.current?.contains(element);
      const crossingGutter=activeGeometry&&editorControlBridge(event.clientX,event.clientY,activeGeometry.left,activeGeometry.rect.left+2,activeGeometry.top);
      if (onControls || crossingGutter) { cancelHide();controlHover(active);return; }
      controlHover(null);
      if(element?.closest('[data-column-resize]')){cancelHide();selectTarget(null);return;}
      const wrapper = editorCanvas(editor).getBoundingClientRect();
      if (!wrapper || event.clientX < wrapper.left || event.clientX > wrapper.right || event.clientY < wrapper.top || event.clientY > wrapper.bottom) { hide(); return; }
      if (element && element !== editor.view.dom && !["UL", "OL"].includes(element.tagName) && editor.view.dom.contains(element)) {
        try {
          const next = blockAt(editor, editor.view.posAtDOM(element, 0));
          if (next) { const geometry=blockGeometry(editor,next);cancelHide();selectTarget(geometry&&editorControlZone(geometry.rect,event.clientX,event.clientY,geometry.left,geometry.rect.right+48)==='block'?next:null);return; }
        } catch { /* The gutter can have no document position */ }
      }
      const next = nearest(editor, { x: event.clientX, y: event.clientY }, true);
      const geometry=next?blockGeometry(editor,next.target):null;
      if (next&&geometry&&editorControlZone(geometry.rect,event.clientX,event.clientY,geometry.left,geometry.rect.right+48)==='block') { cancelHide(); selectTarget(next.target); }
      else if(next&&geometry){cancelHide();selectTarget(null);}
      else hide();
    };
    const up = (event: PointerEvent) => { if (event.pointerId === press.current?.pointerId) { event.preventDefault(); finish(true); } };
    const cancel = () => finish(false);
    const escape = (event: KeyboardEvent) => { if (press.current && event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finish(false); } };
    const refresh = ({ transaction }: { transaction: Transaction }) => {
      const selection=editor.state.selection;
      if (targetRef.current) {
        const mapped = transaction.mapping.mapResult(targetRef.current.pos);
        selectTarget(mapped.deleted ? null : blockAt(editor, mapped.pos, true));
      }
      if(transaction.selectionSet&&selection instanceof NodeSelection&&(['columns','column','bulletList','orderedList','taskList','listItem','taskItem'].includes(selection.node.type.name)||['listItem','taskItem'].includes(selection.$from.parent.type.name)))selectTarget(blockAt(editor,selection.from,true));
      if (press.current && transaction.docChanged) {
        const mapped = transaction.mapping.mapResult(press.current.source.pos);
        const source = mapped.deleted ? null : blockAt(editor, mapped.pos, true);
        if (source) press.current.source = source; else finish(false);
      }
    };
    const layout = (event:Event) => {
      // Scrolling a menu or a discussion does not move the document handles.
      if(event.type==='scroll'&&event.target instanceof Element&&!event.target.contains(editor.view.dom))return;
      reposition((n) => n + 1); updateDrop();
    };
    document.addEventListener("pointermove", moved);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("scroll", layout, true);
    window.addEventListener("resize", layout);
    editor.on("transaction", refresh);
    return () => {
      cancelHide(); controlHover(null); finish(false);
      document.removeEventListener("pointermove", moved); document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel); document.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", cancel); window.removeEventListener("scroll", layout, true); window.removeEventListener("resize", layout);
      editor.off("transaction", refresh);
    };
  }, [editor, container, handles, editable, selectTarget]);

  const onGripPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, source: BlockTarget) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    ensureBlockId(editor,source);
    const next = blockAt(editor, source.pos, true);
    if (!next) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { source: next, origin: { x: event.clientX, y: event.clientY }, point: { x: event.clientX, y: event.clientY }, pointerId: event.pointerId, button: event.currentTarget, started: false, drop: null };
  };
  return { target, dropLine, ghost, dragging, onGripPointerDown };
}
