import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { CommentThread } from "./comment-types";
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
function textAnchor(node:ProseMirrorNode){
  const offsets:number[]=[];let text='';
  node.descendants((child,offset)=>{if(child.isText){for(let i=0;i<child.text!.length;i++)offsets.push(offset+i);text+=child.text;}});
  return {text,offsets};
}
function quoteRange(source:ReturnType<typeof textAnchor>,item:{quote:string;anchorOffset:number|null}){
  const {text,offsets}=source,preferred=item.anchorOffset===null?-1:offsets.indexOf(item.anchorOffset);
  const start=item.quote?preferred>=0&&text.slice(preferred,preferred+item.quote.length)===item.quote?preferred:text.indexOf(item.quote):-1;
  return start<0?null:{from:1+offsets[start],to:2+offsets[start+item.quote.length-1]};
}
/** Overlapping highlights open the most specific quote at the caret position. */
export function commentThreadAt(editor:Editor,threads:CommentThread[],blockId:string,position:number):CommentThread|null{
  let found:CommentThread|null=null;
  editor.state.doc.descendants((node,pos)=>{
    if(node.attrs.blockId!==blockId)return;
    const source=textAnchor(node);
    const candidates=threads.filter(item=>item.blockId===blockId&&!item.resolved).map(item=>({item,range:quoteRange(source,item)??{from:1,to:node.nodeSize-1}})).filter(({range})=>position>=pos+range.from&&position<pos+range.to).sort((a,b)=>(a.range.to-a.range.from)-(b.range.to-b.range.from));
    found=candidates[0]?.item??null;return false;
  });
  return found;
}
type Anchors = { threads: CommentThread[]; active: string | null; hovered?: string | null; draft: { blockId: string; quote: string; anchorOffset: number | null } | null; drafts?: { id: string; blockId: string; quote: string; anchorOffset: number | null }[]; spaces?: { pos: number; height: number }[] };
const key = new PluginKey<Anchors>("commentAnchors");
export const CommentAnchors = Extension.create({
  name: "commentAnchors",
  addProseMirrorPlugins() {
    return [new Plugin<Anchors>({ key, state: {
      init: () => ({ threads: [], active: null, draft: null }),
      apply: (tr, old) => tr.getMeta(key) ?? old,
    }, props: { decorations(state) {
      const anchors = key.getState(state)!;
      const decorations: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        const space = anchors.spaces?.find((item) => item.pos === pos);
        if (space) decorations.push(Decoration.node(pos, pos + node.nodeSize, { "data-comment-inline-space": "true", style: `--comment-inline-space: ${space.height}px` }));
        if (!node.attrs.blockId) return;
        const threads = anchors.threads.filter((t) => t.blockId === node.attrs.blockId && (!t.resolved || t.id === anchors.active));
        const draft = [...(anchors.drafts ?? []).filter((item) => item.blockId === node.attrs.blockId), ...(anchors.draft && anchors.draft.blockId === node.attrs.blockId ? [{ ...anchors.draft, id: "draft" }] : [])];
        if (!threads.length && !draft.length) return;
        const source=textAnchor(node);
        for (const item of [...threads, ...draft]) {
          const focused = item.id === anchors.active;
          const hovered = item.id === anchors.hovered;
          const classes = `${focused ? " editor-comment-anchor-active" : ""}${hovered ? " editor-comment-anchor-hover" : ""}`;
          const attributes = { "data-comment-anchor-id": item.id };
          // Keep the saved range when it still matches; relocate its quote after edits.
          const range=quoteRange(source,item);
          if (range) decorations.push(Decoration.inline(pos + range.from, pos + range.to, { ...attributes, class: `editor-comment-anchor${classes}` }));
          else decorations.push(Decoration.node(pos, pos + node.nodeSize, { ...attributes, class: `editor-comment-anchor-block${classes}` }));
        }
        if (threads.some((t) => !t.resolved)) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "editor-commented-block" }));
      });
      return DecorationSet.create(state.doc, decorations);
    } } })];
  },
});
export function setCommentAnchors(editor: Editor, anchors: Anchors) {
  if (editor.extensionManager.extensions.some((e) => e.name === "commentAnchors")) {
    const changed=JSON.stringify(key.getState(editor.state)?.spaces??[])!==JSON.stringify(anchors.spaces??[]);
    editor.view.dispatch(editor.state.tr.setMeta(key, anchors).setMeta('relay:comment-layout',changed).setMeta("addToHistory", false));
  }
}
