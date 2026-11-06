"use client";
import { useLayoutEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import {TextSelection} from '@tiptap/pm/state';
import { captureCaret, pageResumeKey, parsePageResume, resumeSelection, type PageResume } from "./page-resume";
import { editorCanvas } from "./use-editor-canvas";
import {focusEditor} from './focus-editor';

/** UI state stays local to this account/page; it never creates document revisions. */
export function usePageResume(editor: Editor | null, scope: { identity: string; pageId: string } | undefined, explicitFocus = false) {
  const identity = scope?.identity, pageId = scope?.pageId;
  const focusOverride = useRef(explicitFocus);
  focusOverride.current = explicitFocus;
  useLayoutEffect(() => {
    if (!editor || !identity || !pageId) return;
    const dom = editor.view.dom, key = pageResumeKey(identity, pageId);
    const findPort=()=>{for(let element:HTMLElement|null=editorCanvas(editor);element;element=element.parentElement)if(/(auto|scroll)/.test(getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+1)return element;return document.scrollingElement as HTMLElement;};
    let port: HTMLElement = findPort();
    if (!port) return;
    let saved: PageResume | null = null;
    try { saved = parsePageResume(localStorage.getItem(key)); } catch { /* Storage may be disabled. */ }
    const hash = new URLSearchParams(location.hash.slice(1));
    const targeted = focusOverride.current || ((!hash.has("page") || hash.get("page") === pageId) && (hash.has("block") || hash.has("comment")));
    // The scroll port may be reused by a different page/account.
    if (!saved && !targeted) saved = {version:1,scroll:0,viewport:null,caret:null,editing:false};
    let restoring = Boolean(saved && !targeted), touched = false, timer = 0;
    let caret = saved?.caret ?? null, editing = saved?.editing ?? false;
    let latest:PageResume|null=saved;
    const top = () => port === document.scrollingElement ? 0 : port.getBoundingClientRect().top + port.clientTop;
    const restore = () => {
      if (!restoring || touched || !saved || editor.isDestroyed) return;
      if (focusOverride.current) { restoring = false; return; }
      port=findPort();
      const block = saved.viewport && dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(saved.viewport.block)}"]`);
      const scroll = block && saved.viewport ? port.scrollTop + block.getBoundingClientRect().top - top() - saved.viewport.offset : saved.scroll;
      // Instant restoration before paint avoids a trip through the beginning of a long page.
      port.scrollTo({ top: Math.max(0, scroll), behavior: "instant" });
    };
    const save = () => {
      if (restoring) return;
      if(editor.isDestroyed||!dom.isConnected){if(latest)try{localStorage.setItem(key,JSON.stringify(latest));}catch{}return;}
      port=findPort();
      const blocks = [...dom.querySelectorAll<HTMLElement>("[data-block-id]")];
      const block = blocks.find((node) => node.getBoundingClientRect().bottom > top() + 24);
      const state: PageResume = { version: 1, scroll: port.scrollTop,
        viewport: block ? {block: block.dataset.blockId!, offset: block.getBoundingClientRect().top - top()} : null,
        caret, editing };
      latest=state;
      try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Keep editing when storage is unavailable. */ }
    };
    const schedule = () => { clearTimeout(timer); timer = window.setTimeout(save, 180); };
    const interact = () => { touched = true; restoring = false; };
    const transaction = () => {
      if (editor.view.hasFocus()&&editor.state.selection instanceof TextSelection) { caret = captureCaret(editor.state.doc, editor.state.selection.head); editing = true; }
      schedule();
    };
    const focus = () => { if(!restoring)interact(); transaction(); };
    // Navigation can unmount/destroy TipTap before a debounced write gets a turn.
    const leaving=(event:PointerEvent)=>{if(event.target instanceof Node&&!dom.contains(event.target))save();};
    const observer = new ResizeObserver(restore);
    if (restoring && saved) {
      if (saved.caret) editor.view.dispatch(editor.state.tr.setSelection(resumeSelection(editor.state.doc, saved.caret)).setMeta("addToHistory", false));
      restore(); observer.observe(dom); observer.observe(port);
      void document.fonts.ready.then(restore);
      if (saved.caret && editor.isEditable) {focusEditor(editor);restore();}
    }
    let focusFrame=0;
    const frame = requestAnimationFrame(()=>{
      restore();
      // EditorContent and a schema-normalized setContent may finish after the
      // parent's layout effect. Restore the actual DOM caret after that commit.
      focusFrame=requestAnimationFrame(()=>{if(!restoring||touched||!saved?.caret||focusOverride.current||editor.isDestroyed)return;editor.view.dispatch(editor.state.tr.setSelection(resumeSelection(editor.state.doc,saved.caret)).setMeta('addToHistory',false));focusEditor(editor);restore();});
    });
    const settled = window.setTimeout(() => { restoring = false; observer.disconnect(); }, 1200);
    const scrolling=(event:Event)=>{if(event.target===document||event.target instanceof Element&&event.target.contains(dom))schedule();};
    const input=(event:Event)=>{if(event.target instanceof Node&&editorCanvas(editor).contains(event.target))interact();};
    window.addEventListener("scroll", scrolling, { passive: true,capture:true });
    window.addEventListener("wheel", input, {passive:true,capture:true});window.addEventListener('pointerdown',input,true);window.addEventListener('keydown',input,true);dom.addEventListener("focus", focus);
    editor.on("transaction", transaction);
    document.addEventListener('pointerdown',leaving,true);
    const flush = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", flush); window.addEventListener("pagehide", save);
    return () => {
      cancelAnimationFrame(frame);cancelAnimationFrame(focusFrame); clearTimeout(settled); clearTimeout(timer); observer.disconnect();
      // Do not overwrite a stored position during an interrupted, untouched mount.
      save(); restoring = false;
      window.removeEventListener('scroll',scrolling,true);window.removeEventListener('wheel',input,true);window.removeEventListener('pointerdown',input,true);window.removeEventListener('keydown',input,true);dom.removeEventListener("focus", focus);
      editor.off("transaction", transaction); document.removeEventListener("visibilitychange", flush); window.removeEventListener("pagehide", save);
      document.removeEventListener('pointerdown',leaving,true);
    };
  }, [editor, identity, pageId]);
}
