import type {Editor} from '@tiptap/core';
import type {Node} from '@tiptap/pm/model';
export function editorPlaceholder({node,hasAnchor=true}:{node:Node;pos:number;editor:Editor;hasAnchor?:boolean},t:(key:string)=>string){
  if(node.type.name==='codeBlock'||node.type.name==='toggleTitle')return '';
  // Decorations are built while applying a transaction, before editor.state changes.
  // Parent-specific placeholders belong in CSS rather than resolving the old doc.
  if(!hasAnchor)return '';
  return t(node.type.name==='heading'?'headingPlaceholder':'placeholder');
}
