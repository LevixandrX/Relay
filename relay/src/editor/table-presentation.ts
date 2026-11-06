import {Extension,type Editor} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
const key=new PluginKey<DecorationSet>('tableDragPresentation');
export const TablePresentation=Extension.create({name:'tablePresentation',addProseMirrorPlugins(){return[new Plugin<DecorationSet>({key,state:{init:()=>DecorationSet.empty,apply(tr,old){const source=tr.getMeta(key) as number[]|undefined;if(source!==undefined)return DecorationSet.create(tr.doc,source.flatMap(pos=>{const node=tr.doc.nodeAt(pos);return node?[Decoration.node(pos,pos+node.nodeSize,{class:'rich-table-drag-origin'})]:[];}));return old.map(tr.mapping,tr.doc);}},props:{decorations:state=>key.getState(state)}})];}});
export function tableDragPresentation(editor:Editor,cells:number[]){editor.view.dispatch(editor.state.tr.setMeta(key,cells).setMeta('addToHistory',false));}
