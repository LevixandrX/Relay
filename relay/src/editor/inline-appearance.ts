import {Mark,mergeAttributes} from '@tiptap/core';
const color=(v:unknown)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:null;
export const InlineAppearance=Mark.create({
  name:'textStyle',
  addAttributes(){return{color:{default:null,parseHTML:el=>color(el.getAttribute('data-inline-color'))},backgroundColor:{default:null,parseHTML:el=>color(el.getAttribute('data-inline-background'))}};},
  parseHTML(){return[{tag:'span[data-inline-color]'},{tag:'span[data-inline-background]'}];},
  renderHTML({HTMLAttributes}){const foreground=color(HTMLAttributes.color),background=color(HTMLAttributes.backgroundColor);return['span',mergeAttributes(foreground?{'data-inline-color':foreground}:{},background?{'data-inline-background':background}:{},{style:[foreground?`color:${foreground}`:'',background?`background-color:${background}`:''].filter(Boolean).join(';')}),0];}
});
