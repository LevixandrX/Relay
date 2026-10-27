import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import type { BlockTarget } from "./block-commands";
import {indentEditorSelection} from './block-indent';
export const COLOR_NAMES = ["default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export const COLOR_VALUES: Record<string, string | null> = { default: null, gray: "#969696", brown: "#ae8061", orange: "#e59443", yellow: "#d5b44b", green: "#69ac83", blue: "#6aabe4", purple: "#ac88d4", pink: "#d582ac", red: "#e17676" };
export const validColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const types = ["columns", "column", "paragraph", "heading", "bulletList", "orderedList", "taskList", "listItem", "taskItem", "blockquote", "callout", "codeBlock", "horizontalRule", "promptBlock"];
export const BlockAppearance = Extension.create({
  name: "blockAppearance",
  priority:1000,
  addKeyboardShortcuts(){return {Tab:()=>indentEditorSelection(this.editor,1),'Shift-Tab':()=>indentEditorSelection(this.editor,-1)};},
  addGlobalAttributes() { return [{ types, attributes: {
    blockIndent: { default: 0, parseHTML: (el) => Math.max(0, Math.min(8, Number(el.getAttribute("data-block-indent")) || 0)), renderHTML: (attrs) => attrs.blockIndent ? { "data-block-indent": attrs.blockIndent, style: `--block-indent: ${attrs.blockIndent}` } : {} },
    blockId: { default: null, parseHTML: (el) => /^blk_[a-zA-Z0-9-]{8,80}$/.test(el.getAttribute("data-block-id") ?? "") ? el.getAttribute("data-block-id") : null, renderHTML: (attrs) => attrs.blockId ? { "data-block-id": attrs.blockId, id: attrs.blockId } : {} },
    textColor: { default: null, parseHTML: (el) => validColor(el.getAttribute("data-text-color")) ? el.getAttribute("data-text-color") : null, renderHTML: (attrs) => validColor(attrs.textColor) ? { "data-text-color": attrs.textColor, style: `--block-text: ${attrs.textColor}` } : {} },
    blockBackground: { default: null, parseHTML: (el) => validColor(el.getAttribute("data-block-background")) ? el.getAttribute("data-block-background") : null, renderHTML: (attrs) => validColor(attrs.blockBackground) ? { "data-block-background": attrs.blockBackground, style: `--block-bg: ${attrs.blockBackground}` } : {} },
  } }]; },
  addProseMirrorPlugins() { return [new Plugin({ key: new PluginKey("blockIdentity"), appendTransaction(transactions, _old, state) {
    if (!transactions.some((t) => t.docChanged)) return null;
    const seen = new Set<string>(), tr = state.tr;
    state.doc.descendants((node, pos) => {
      if (!types.includes(node.type.name)) return;
      if (!node.attrs.blockId) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: `blk_${crypto.randomUUID()}` }); return; }
      if (seen.has(node.attrs.blockId)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: `blk_${crypto.randomUUID()}` });
      seen.add(node.attrs.blockId);
    });
    return tr.docChanged ? tr : null;
  },props:{decorations(state){
    const decorations:Decoration[]=[];
    const walk=(node:typeof state.doc,pos:number,paint:string|null,bulletDepth=0,orderedDepth=0)=>{
      const own=node.attrs.blockBackground as string|null;
      if(own&&own===paint)decorations.push(Decoration.node(pos,pos+node.nodeSize,{'data-block-paint-duplicate':'true'}));
      if(node.type.name==='bulletList'||node.type.name==='orderedList')decorations.push(Decoration.node(pos,pos+node.nodeSize,{'data-list-level':String((node.type.name==='bulletList'?bulletDepth:orderedDepth)%3)}));
      node.forEach((child,offset)=>{if(!child.isText)walk(child,pos+1+offset,own||paint,bulletDepth+(node.type.name==='bulletList'?1:0),orderedDepth+(node.type.name==='orderedList'?1:0));});
    };
    state.doc.forEach((node,pos)=>walk(node,pos,null));return DecorationSet.create(state.doc,decorations);
  }} })]; },
});
export function ensureBlockId(editor: Editor, target: BlockTarget): string {
  if (target.node.attrs.blockId) return target.node.attrs.blockId;
  const id = `blk_${crypto.randomUUID()}`;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, blockId: id }).setMeta("addToHistory", false));
  return id;
}
export function applyBlockColor(editor: Editor, target: BlockTarget, kind: "text" | "background", color: string | null, newGroup = true) {
  if (color !== null && !validColor(color)) return;
  const attr = kind === "text" ? "textColor" : "blockBackground";
  const tr = editor.state.tr;
  tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, [attr]: color });
  if(['bulletList','orderedList','taskList','listItem','taskItem','columns','column'].includes(target.node.type.name))target.node.descendants((node,pos)=>{if(node.attrs[attr]!=null)tr.setNodeMarkup(target.pos+1+pos,undefined,{...node.attrs,[attr]:null});});
  editor.view.dispatch(newGroup?closeHistory(tr):tr);
}
