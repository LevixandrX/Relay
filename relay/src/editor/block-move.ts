import {Fragment,type Node as PMNode} from '@tiptap/pm/model';
import {NodeSelection,type EditorState,type Transaction} from '@tiptap/pm/state';
import type {BlockTarget} from './block-commands';
const lists=['bulletList','orderedList','taskList'],items=['listItem','taskItem'];
type Direction='up'|'down';
const children=(node:PMNode)=>Array.from({length:node.childCount},(_,i)=>node.child(i));

function finish(tr:Transaction,id:string|null,fallback:number){
  let selected:number|null=null;
  if(id)tr.doc.descendants((node,pos)=>{if(node.attrs.blockId===id){selected=pos;return false;}});
  const pos=selected??fallback;
  if(pos>=0&&pos<tr.doc.content.size&&tr.doc.nodeAt(pos)?.isBlock)tr.setSelection(NodeSelection.create(tr.doc,pos));
  tr.doc.check();return tr;
}

/** Plan first, then dispatch exactly the same operation used for availability. */
export function planBlockMove(state:EditorState,target:BlockTarget,direction:Direction):Transaction|null{
  const node=state.doc.nodeAt(target.pos);if(!node?.isBlock)return null;
  const at=state.doc.resolve(target.pos),row=node.isTextblock&&items.includes(at.parent.type.name);
  const item=row?{pos:at.before(),node:at.parent}:items.includes(node.type.name)?{pos:target.pos,node}:null;
  if(item)return moveItem(state,item,row?target.pos:null,direction);
  const index=at.index(),parent=at.parent,nextIndex=index+(direction==='up'?-1:1);
  if(nextIndex>=0&&nextIndex<parent.childCount){
    const sibling=parent.child(nextIndex),from=direction==='up'?target.pos-sibling.nodeSize:target.pos;
    const pair=direction==='up'?[node,sibling]:[sibling,node],start=Math.min(index,nextIndex);
    if(parent.canReplace(start,start+2,Fragment.fromArray(pair))){
      const tr=state.tr.replaceWith(from,from+node.nodeSize+sibling.nodeSize,pair);
      return finish(tr,node.attrs.blockId,direction==='up'?from:from+sibling.nodeSize);
    }
  }
  // At a container boundary, lift past the nearest ancestor whose parent accepts
  // the block. Structural columns themselves never accept an ordinary block.
  for(let depth=at.depth;depth>0;depth--){
    const outer=at.node(depth-1),outerIndex=at.index(depth-1)+(direction==='down'?1:0);
    const moving=node.type.name==='column'?node.content:Fragment.from(node);
    if(!outer.canReplace(outerIndex,outerIndex,moving))continue;
    const destination=direction==='up'?at.before(depth):at.after(depth),tr=state.tr.delete(target.pos,target.pos+node.nodeSize);
    const insert=tr.mapping.map(destination,direction==='up'?-1:1);tr.insert(insert,moving);
    return finish(tr,node.type.name==='column'?node.firstChild?.attrs.blockId:node.attrs.blockId,insert);
  }
  return null;
}

function moveItem(state:EditorState,item:{pos:number;node:PMNode},rowPos:number|null,direction:Direction):Transaction|null{
  const at=state.doc.resolve(item.pos),list=at.parent;
  if(!lists.includes(list.type.name))return null;
  const index=at.index(),siblingIndex=index+(direction==='up'?-1:1),own=rowPos===null?null:state.doc.nodeAt(rowPos)!;
  const moving=own?item.node.type.create(item.node.attrs,own):item.node;
  if(!moving.type.validContent(moving.content))return null;
  const selectedId=own?.attrs.blockId??item.node.attrs.blockId;
  // Removing only the row promotes its children at the original location.
  const remainder:PMNode[]=[];
  if(own)item.node.forEach((child,offset)=>{
    if(item.pos+1+offset===rowPos)return;
    if(lists.includes(child.type.name))child.forEach(nested=>remainder.push(nested.type===item.node.type?nested:item.node.type.create(nested.attrs,nested.content)));
    else remainder.push(item.node.type.create(null,child));
  });
  if(remainder.some(node=>!node.type.validContent(node.content)))return null;
  const replaceItem=(tr:Transaction)=>{
    if(list.childCount===1&&!remainder.length)tr.delete(at.before(),at.after());
    else tr.replaceWith(item.pos,item.pos+item.node.nodeSize,remainder);
  };
  if(siblingIndex>=0&&siblingIndex<list.childCount){
    const sibling=list.child(siblingIndex),destination=direction==='up'?item.pos-sibling.nodeSize:item.pos+item.node.nodeSize+sibling.nodeSize;
    const tr=state.tr;replaceItem(tr);const insert=tr.mapping.map(destination,direction==='up'?-1:1);tr.insert(insert,moving);
    return finish(tr,selectedId,insert+(own?1:0));
  }
  const listDepth=at.depth,listPos=at.before(),listEnd=at.after();
  const outer=at.node(listDepth-1);
  if(items.includes(outer.type.name)&&listDepth>=2){
    const parentPos=at.before(listDepth-1),parentEnd=at.after(listDepth-1),outerList=at.node(listDepth-2);
    if(!lists.includes(outerList.type.name))return null;
    const compatible=moving.type===outer.type?moving:outer.type.create(moving.attrs,moving.content);
    const tr=state.tr;replaceItem(tr);const insert=tr.mapping.map(direction==='up'?parentPos:parentEnd,direction==='up'?-1:1);tr.insert(insert,compatible);
    return finish(tr,selectedId,insert+(own?1:0));
  }
  const blocks=children(moving).map((child,i)=>i===0&&!own?child.type.create({...child.attrs,...item.node.attrs},child.content):child);
  const outerIndex=at.index(listDepth-1)+(direction==='down'?1:0);
  if(!outer.canReplace(outerIndex,outerIndex,Fragment.fromArray(blocks)))return null;
  const tr=state.tr;replaceItem(tr);const insert=tr.mapping.map(direction==='up'?listPos:listEnd,direction==='up'?-1:1);tr.insert(insert,blocks);
  return finish(tr,selectedId,insert);
}
