import { useEffect, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { pageLayout } from './page-layout';

export function editorCanvas(editor: Editor): HTMLElement {
  return editor.view.dom.closest<HTMLElement>(".relay-page, .editor-card, [data-editor-canvas]") ?? editor.view.dom.closest<HTMLElement>(".relay-editor") ?? editor.view.dom;
}

/** Extend the click/caret surface, keeping the text column's own width. */
export function useEditorCanvas(editor: Editor, container: RefObject<HTMLDivElement | null>, editable: boolean, annotations = false) {
  useEffect(()=>{
    const host=container.current,canvas=editorCanvas(editor);if(!host||host===canvas)return;
    const shell=canvas.closest<HTMLElement>('.shell,.relay-shell');
    let frame=0;
    const measure=()=>{
      const bounds=canvas.getBoundingClientRect(),style=getComputedStyle(canvas),viewport=window.visualViewport;
      const raw=shell?.dataset.chrome;
      const mode=raw==='compact'||raw==='rail'?'compact':raw==='zen'||raw==='focus'?'zen':'normal';
      const contentLeft=bounds.left+canvas.clientLeft+parseFloat(style.paddingLeft||'0');
      const contentRight=bounds.left+canvas.clientLeft+canvas.clientWidth-parseFloat(style.paddingRight||'0');
      const layout=pageLayout({contentLeft,contentRight,viewportLeft:viewport?.offsetLeft??0,viewportRight:(viewport?.offsetLeft??0)+(viewport?.width??window.innerWidth),mode,annotations});
      const values={'--editor-layout-width':`${layout.width}px`,'--editor-layout-left':`${layout.left-contentLeft}px`,'--comment-card-width':`${layout.cardWidth}px`,'--comment-card-gap':`${layout.gap}px`,'--editor-menu-width':`${layout.menuWidth}px`};
      let changed=host.dataset.annotationsSide!==String(layout.side)||host.dataset.editorLayout!==(layout.wide?'wide':'narrow');
      for(const [key,value] of Object.entries(values))if(host.style.getPropertyValue(key)!==value){host.style.setProperty(key,value);changed=true;}
      host.dataset.annotationsSide=String(layout.side);
      host.dataset.editorLayout=layout.wide?'wide':'narrow';
      if(changed&&!editor.isDestroyed)editor.view.dispatch(editor.state.tr.setMeta('relay:comment-layout',true).setMeta('addToHistory',false));
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;measure();});};
    measure();const resize=new ResizeObserver(schedule);resize.observe(canvas);
    const attributes=new MutationObserver(schedule);attributes.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-chrome']});if(shell)attributes.observe(shell,{attributes:true,attributeFilter:['data-chrome']});
    window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
    return()=>{cancelAnimationFrame(frame);resize.disconnect();attributes.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);for(const key of ['--editor-layout-width','--editor-layout-left','--comment-card-width','--comment-card-gap','--editor-menu-width'])host.style.removeProperty(key);delete host.dataset.annotationsSide;delete host.dataset.editorLayout;};
  },[editor,container,annotations]);
  useEffect(() => {
    if (!editable) return;
    const canvas = editorCanvas(editor);
    canvas.classList.add("editor-text-canvas");
    const pointer = (event: PointerEvent) => {
      if (event.button !== 0 || event.shiftKey || !(event.target instanceof Element)) return;
      if (editor.view.dom.contains(event.target) || event.target.closest("button,a,input,textarea,select,[role=button],[contenteditable=false],.editor-comment-layer,.editor-comments-list")) return;
      if (!canvas.contains(event.target)) return;
      const rect = editor.view.dom.getBoundingClientRect();
      const position = editor.view.posAtCoords({ left: Math.max(rect.left + 1, Math.min(rect.right - 1, event.clientX)), top: Math.max(rect.top + 1, Math.min(rect.bottom - 1, event.clientY)) });
      if (!position) return;
      event.preventDefault();
      const selection = TextSelection.near(editor.state.doc.resolve(position.pos));
      editor.view.dispatch(editor.state.tr.setSelection(selection));
      editor.commands.focus(undefined, { scrollIntoView: false });
    };
    canvas.addEventListener("pointerdown", pointer);
    return () => { canvas.classList.remove("editor-text-canvas"); canvas.removeEventListener("pointerdown", pointer); };
  }, [editor, container, editable]);
}
