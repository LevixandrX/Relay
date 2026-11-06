import type {Editor} from '@tiptap/core';
import {TextSelection,NodeSelection} from '@tiptap/pm/state';

/** Focus and DOM selection must agree before the next keystroke. */
export function focusEditor(editor:Editor){
  if(editor.isDestroyed||!editor.isEditable)return;
  editor.view.focus();
}

/** Attribute editors finish at the block they changed, without scrolling to an old caret. */
export function blockCaret(editor:Editor,pos:number){
  const node=editor.state.doc.nodeAt(pos);
  const selection=editor.state.selection;
  if(node&&selection instanceof TextSelection&&selection.from>pos&&selection.to<pos+node.nodeSize)return selection;
  if(node?.isAtom&&!node.isTextblock)return NodeSelection.create(editor.state.doc,pos);
  return TextSelection.near(editor.state.doc.resolve(Math.min(editor.state.doc.content.size,pos+1)));
}
export function focusBlock(editor:Editor,pos:number|undefined){
  if(editor.isDestroyed||typeof pos!=='number')return;
  editor.view.dispatch(editor.state.tr.setSelection(blockCaret(editor,pos)).setMeta('addToHistory',false));
  focusEditor(editor);
}
