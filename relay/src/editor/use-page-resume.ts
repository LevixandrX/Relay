"use client";
import { useLayoutEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { captureCaret, pageResumeKey, parsePageResume, resumeSelection, type PageResume } from "./page-resume";
import { editorCanvas } from "./use-editor-canvas";

/** UI state stays local to this account/page; it never creates document revisions. */
export function usePageResume(editor: Editor | null, scope: { identity: string; pageId: string } | undefined, explicitFocus = false) {
  const identity = scope?.identity, pageId = scope?.pageId;
  const focusOverride = useRef(explicitFocus);
  focusOverride.current = explicitFocus;
  useLayoutEffect(() => {
    if (!editor || !identity || !pageId) return;
    const dom = editor.view.dom, key = pageResumeKey(identity, pageId);
    let port: HTMLElement = editorCanvas(editor);
    while (port.parentElement && !/(auto|scroll)/.test(getComputedStyle(port).overflowY)) port = port.parentElement;
    if (!/(auto|scroll)/.test(getComputedStyle(port).overflowY)) port = document.scrollingElement as HTMLElement;
    if (!port) return;
    let saved: PageResume | null = null;
    try { saved = parsePageResume(localStorage.getItem(key)); } catch { /* Storage may be disabled. */ }
    const hash = new URLSearchParams(location.hash.slice(1));
    const targeted = focusOverride.current || ((!hash.has("page") || hash.get("page") === pageId) && (hash.has("block") || hash.has("comment")));
    // The scroll port may be reused by a different page/account.
    if (!saved && !targeted) saved = {version:1,scroll:0,viewport:null,caret:null,editing:false};
    let restoring = Boolean(saved && !targeted), touched = false, timer = 0;
    let caret = saved?.caret ?? null, editing = saved?.editing ?? false;
    const top = () => port === document.scrollingElement ? 0 : port.getBoundingClientRect().top + port.clientTop;
    const restore = () => {
      if (!restoring || touched || !saved || editor.isDestroyed) return;
      if (focusOverride.current) { restoring = false; return; }
      const block = saved.viewport && dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(saved.viewport.block)}"]`);
      const scroll = block && saved.viewport ? port.scrollTop + block.getBoundingClientRect().top - top() - saved.viewport.offset : saved.scroll;
      // Instant restoration before paint avoids a trip through the beginning of a long page.
      port.scrollTo({ top: Math.max(0, scroll), behavior: "instant" });
    };
    const save = () => {
      if (restoring || editor.isDestroyed) return;
      const blocks = [...dom.querySelectorAll<HTMLElement>("[data-block-id]")];
      const block = blocks.find((node) => node.getBoundingClientRect().bottom > top() + 24);
      const state: PageResume = { version: 1, scroll: port.scrollTop,
        viewport: block ? {block: block.dataset.blockId!, offset: block.getBoundingClientRect().top - top()} : null,
        caret, editing };
      try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Keep editing when storage is unavailable. */ }
    };
    const schedule = () => { clearTimeout(timer); timer = window.setTimeout(save, 180); };
    const interact = () => { touched = true; restoring = false; };
    const transaction = () => {
      if (editor.view.hasFocus()) { caret = captureCaret(editor.state.doc, editor.state.selection.head); editing = true; }
      schedule();
    };
    const focus = () => { interact(); transaction(); };
    const observer = new ResizeObserver(restore);
    if (restoring && saved) {
      if (saved.caret) editor.view.dispatch(editor.state.tr.setSelection(resumeSelection(editor.state.doc, saved.caret)).setMeta("addToHistory", false));
      restore(); observer.observe(dom); observer.observe(port);
      void document.fonts.ready.then(restore);
      const active = document.activeElement;
      if (saved.editing && editor.isEditable && (!active || active === document.body || dom.contains(active))) editor.view.focus();
    }
    const frame = requestAnimationFrame(restore);
    const settled = window.setTimeout(() => { restoring = false; observer.disconnect(); }, 1200);
    const scrollTarget = port === document.scrollingElement ? window : port;
    scrollTarget.addEventListener("scroll", schedule, { passive: true });
    port.addEventListener("wheel", interact, {passive:true}); port.addEventListener("pointerdown", interact, {passive:true});
    port.addEventListener("keydown", interact); dom.addEventListener("focus", focus);
    editor.on("transaction", transaction);
    const flush = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", flush); window.addEventListener("pagehide", save);
    return () => {
      cancelAnimationFrame(frame); clearTimeout(settled); clearTimeout(timer); observer.disconnect();
      // Do not overwrite a stored position during an interrupted, untouched mount.
      save(); restoring = false;
      scrollTarget.removeEventListener("scroll", schedule); port.removeEventListener("wheel", interact);
      port.removeEventListener("pointerdown", interact); port.removeEventListener("keydown", interact); dom.removeEventListener("focus", focus);
      editor.off("transaction", transaction); document.removeEventListener("visibilitychange", flush); window.removeEventListener("pagehide", save);
    };
  }, [editor, identity, pageId]);
}
