/** Nested SVG/KaTeX spans are controls too; selecting their atom can eat the click. */
export function stopBlockToolEvent({event}:{event:Event}){
  if(event.type==='drop'||event.type.startsWith('drag'))return false;
  return event.target instanceof Element&&Boolean(event.target.closest('button,input,textarea,select,a,[contenteditable="false"]'));
}
/** React attaches a new contentDOM after ProseMirror's selection update. */
export function focusAfterBlockRender(editor:import('@tiptap/core').Editor){
  if(typeof window==='undefined')return;
  requestAnimationFrame(()=>{if(editor.isDestroyed||editor.view.composing)return;const active=document.activeElement;if(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement)return;if(active instanceof HTMLElement&&active!==document.body&&!editor.view.dom.contains(active)&&!active.closest('.editor-block-menu'))return;editor.view.focus();});
}
