import type {Editor} from '@tiptap/core';
export function openBlockTools(editor:Editor,pos:number,anchor?:HTMLElement){editor.view.dom.dispatchEvent(new CustomEvent('relay-block-tools',{detail:{pos,anchor},bubbles:false}));}
