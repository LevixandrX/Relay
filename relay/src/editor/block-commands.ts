import { closeHistory } from "@tiptap/pm/history";
import {focusAfterBlockRender} from './node-view-events';
import {MAX_COLUMNS} from '../domain/blocks/columns';
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import {planBlockMove} from './block-move';
import { MEDIA_TYPES, webUrl, embedUrl } from '../domain/blocks/rich-content';
export const BLOCK_TYPES = ["text", "h1", "h2", "h3", "h4", "bullet", "numbered", "todo", "toggle", "quote", "callout", "code", "divider", "table", ...MEDIA_TYPES, "bookmark", "embed", "equation", "inlineMath", "toc", "page", "pageLink", "toggleH1", "toggleH2", "toggleH3", "toggleH4", "columns2", "columns3", "columns4", "columns5", "prompt"] as const;
export type BlockType = typeof BLOCK_TYPES[number];
export type BlockTarget = { pos: number; node: PMNode; parentType?: string };
export type BlockAction = "duplicate" | "delete" | "up" | "down";
export function blockAncestor(editor:Editor,target:BlockTarget,type:string){
  const resolved=editor.state.doc.resolve(target.pos);
  for(let depth=resolved.depth;depth>0;depth--)if(resolved.node(depth).type.name===type)return blockAt(editor,resolved.before(depth),true);
  return null;
}
export function listSelectionTarget(editor:Editor,target:BlockTarget,scope:'item'|'list',itemId?:string|null):BlockTarget|null{
  const lists=['bulletList','orderedList','taskList'],items=['listItem','taskItem'];
  const resolved=editor.state.doc.resolve(target.pos);
  if(scope==='list'){
    for(let depth=1;depth<=resolved.depth;depth++)if(lists.includes(resolved.node(depth).type.name))return blockAt(editor,resolved.before(depth),true);
    return lists.includes(target.node.type.name)?target:null;
  }
  if(items.includes(target.node.type.name))return target;
  if(!lists.includes(target.node.type.name)){
    for(let depth=resolved.depth;depth>0;depth--)if(items.includes(resolved.node(depth).type.name))return blockAt(editor,resolved.before(depth),true);
    return null;
  }
  let first:BlockTarget|null=null,remembered:BlockTarget|null=null;
  target.node.descendants((node,pos)=>{
    if(!items.includes(node.type.name))return;
    const found=blockAt(editor,target.pos+1+pos,true);
    first??=found;if(itemId&&node.attrs.blockId===itemId)remembered=found;
  });
  return remembered??first;
}
/** The item's own text block, excluding nested lists. */
export function listRowTarget(editor:Editor,target:BlockTarget,itemId?:string|null):BlockTarget|null{
  const item=listSelectionTarget(editor,target,'item',itemId);
  if(!item)return null;
  let result:BlockTarget|null=null;
  item.node.forEach((node,offset)=>{if(!result&&node.isTextblock)result=blockAt(editor,item.pos+1+offset,true);});
  return result;
}
/** Ignore structural wrappers when they contain exactly the same selection. */
export function sameBlockSelection(a:BlockTarget,b:BlockTarget){
  const unwrap=(target:BlockTarget)=>{
    let {pos,node}=target;
    while(['bulletList','orderedList','taskList','listItem','taskItem'].includes(node.type.name)&&node.childCount===1){pos++;node=node.firstChild!;}
    return {from:pos,to:pos+node.nodeSize};
  };
  const left=unwrap(a),right=unwrap(b);return left.from===right.from&&left.to===right.to;
}
export function canMoveBlock(editor:Editor,target:BlockTarget,direction:'up'|'down'){
  return Boolean(planBlockMove(editor.state,target,direction));
}
export function blockAt(editor: Editor, position: number, exact = false): BlockTarget | null {
  const pos = Math.max(0, Math.min(position, editor.state.doc.content.size));
  const direct = editor.state.doc.nodeAt(pos);
  if (direct?.isBlock && (exact || ["listItem", "taskItem"].includes(direct.type.name))) return { pos, node: direct, parentType: editor.state.doc.resolve(pos).parent.type.name };
  const resolved = editor.state.doc.resolve(pos);
  let depth = 1;
  for (let current = 1; current <= resolved.depth; current++) { if (["column","toggleContent","callout","blockquote","tableCell","tableHeader"].includes(resolved.node(current).type.name) && current < resolved.depth) depth = current + 1; }
  for (let current = resolved.depth; current > 0; current--) {
    if (["listItem", "taskItem"].includes(resolved.node(current).type.name)) { depth = current; break; }
  }
  const start = resolved.depth ? resolved.before(Math.min(depth, resolved.depth)) : pos;
  const node = editor.state.doc.nodeAt(start);
  return node?.isBlock ? { pos: start, node, parentType: editor.state.doc.resolve(start).parent.type.name } : null;
}
export function blockType(node: PMNode, parentType?: string): BlockType {
  if(node.type.name==='pageLink'&&node.attrs.createNew)return'page';
  if (node.type.name === "taskItem") return "todo";
  if (node.type.name === "listItem") return parentType === "orderedList" ? "numbered" : "bullet";
  if (node.type.name === "heading") return `h${node.attrs.level}` as BlockType;
  if (node.type.name === 'toggle') return node.attrs.level ? `toggleH${node.attrs.level}` as BlockType : 'toggle';
  if (node.type.name === 'columns') return `columns${Math.min(5,node.childCount)}` as BlockType;
  if (node.type.name === 'tableOfContents') return 'toc';
  if (BLOCK_TYPES.includes(node.type.name as BlockType)) return node.type.name as BlockType;
  return ({ paragraph: "text", bulletList: "bullet", orderedList: "numbered", taskList: "todo", blockquote: "quote", callout: "callout", codeBlock: "code", horizontalRule: "divider", promptBlock: "prompt" } as Record<string, BlockType>)[node.type.name] ?? "text";
}
/** Whole-block handles share the first callout line and never enter table cells. */
export function blockHandleTarget(editor:Editor,target:BlockTarget):BlockTarget{
  const resolved=editor.state.doc.resolve(target.pos);
  for(let d=resolved.depth;d>0;d--){const parent=resolved.node(d);let first=true;for(let child=d;child<=resolved.depth;child++)if(resolved.index(child)!==0)first=false;if(parent.type.name==='table'||parent.type.name==='callout'&&first)return blockAt(editor,resolved.before(d),true)??target;}
  return target;
}
// Preserve text and produce schema-valid content when converting a whole block
export function convertedBlock(schema: Schema, source: PMNode, type: BlockType): PMNode {
  const paragraphs: PMNode[] = [];
  if (source.isTextblock) {
    paragraphs.push(schema.nodes.paragraph.create(null, source.type.name === "codeBlock" ? (source.textContent ? schema.text(source.textContent) : null) : source.content));
  } else source.descendants((node) => {
    if (!node.isTextblock) return true;
    paragraphs.push(schema.nodes.paragraph.create(null, node.content));
    return false;
  });
  if (!paragraphs.length) {const text=String(source.attrs.latex||source.attrs.caption||source.attrs.src||source.attrs.title||'');paragraphs.push(schema.nodes.paragraph.create(null,text?schema.text(text):null));}
  if(type === 'toggle' || type.startsWith('toggleH')) return schema.nodes.toggle.create({open:false,level:type==='toggle'?0:Number(type.slice(-1))},[
    schema.nodes.toggleTitle.create(null,paragraphs[0].content),
    schema.nodes.toggleContent.create(null,paragraphs.length>1?paragraphs.slice(1):schema.nodes.paragraph.create()),
  ]);
  if(type.startsWith('columns')) {
    const count=Number(type.slice(-1));
    const first=source.type.name==='columns'?Array.from({length:source.childCount},(_,j)=>source.child(j).content.content).flat():source.type.name==='column'?Array.from({length:source.childCount},(_,j)=>source.child(j)):source.type.name==='listItem'?[schema.nodes.bulletList.create(null,source)]:source.type.name==='taskItem'?[schema.nodes.taskList.create(null,source)]:[source];
    return schema.nodes.columns.create(null,Array.from({length:count},(_,i)=>schema.nodes.column.create({width:1},i===0?first:[schema.nodes.paragraph.create()])));
  }
  if(type === 'table') return schema.nodes.table.create(null,Array.from({length:Math.max(3,paragraphs.length)},(_,row)=>schema.nodes.tableRow.create(null,Array.from({length:3},(_,col)=>schema.nodes[row===0?'tableHeader':'tableCell'].create(null,col===0&&paragraphs[row]?paragraphs[row]:schema.nodes.paragraph.create())))));
  if(MEDIA_TYPES.includes(type as never)||type==='bookmark'||type==='embed')return schema.nodes[type].create({src:type==='embed'?embedUrl(source.textContent):webUrl(source.textContent),caption:source.attrs.caption??'',name:source.attrs.name??''});
  if(type==='equation') return schema.nodes.equation.create({latex:source.textContent});
  if(type==='inlineMath') return schema.nodes.paragraph.create(null,schema.nodes.inlineEquation.create({latex:source.textContent}));
  if(type==='toc') return schema.nodes.tableOfContents.create();
  if(type==='pageLink') return schema.nodes.pageLink.create();
  if(type==='page') return schema.nodes.pageLink.create({createNew:true});
  const inline: PMNode[] = [];
  paragraphs.forEach((paragraph, index) => {
    if (index && schema.nodes.hardBreak) inline.push(schema.nodes.hardBreak.create());
    paragraph.content.forEach((node) => inline.push(node));
  });
  if (type === "text") return schema.nodes.paragraph.create(null, inline);
  if (type.startsWith("h")) return schema.nodes.heading.create({ level: Number(type[1]) }, inline);
  if (type === "code") {
    const text = paragraphs.map((node) => node.textContent).join("\n");
    return schema.nodes.codeBlock.create(null, text ? schema.text(text) : null);
  }
  if (type === "quote" || type === "callout") return schema.nodes[type === "quote" ? "blockquote" : "callout"].create(type === "callout" ? { emoji: "💡" } : null, paragraphs);
  if (type === "divider") return schema.nodes.horizontalRule.create();
  if (type === "prompt") return schema.nodes.promptBlock.create({ prompt: source.textContent, status: "idle" });
  const list = type === "bullet" ? "bulletList" : type === "numbered" ? "orderedList" : "taskList";
  const item = type === "todo" ? "taskItem" : "listItem";
  return schema.nodes[list].create(null, paragraphs.map((paragraph) => schema.nodes[item].create(type === "todo" ? { checked: false } : null, paragraph)));
}
export function changeBlock(editor: Editor, target: BlockTarget, type: BlockType, range?:{from:number;to:number}) {
  if (!range&&blockType(target.node, target.parentType) === type&&!['columns','column'].includes(target.node.type.name)) { editor.commands.focus(); return; }
  const transaction = closeHistory(editor.state.tr);
  if(range){transaction.delete(range.from,range.to);const pos=transaction.mapping.map(target.pos),node=transaction.doc.nodeAt(pos);if(!node)return;target={...target,pos,node};}
  const sourceItem=['listItem','taskItem'].includes(target.node.type.name);
  const listConversion=['bullet','numbered','todo'].includes(type);
  const tail:PMNode[]=[];
  if(sourceItem&&range)target.node.forEach((child,_offset,index)=>{if(index>0)tail.push(child);});
  let converted = convertedBlock(editor.schema, sourceItem&&range?target.node.firstChild!:target.node, type);
  if(sourceItem&&range&&listConversion&&tail.length)converted=converted.copy(Fragment.from(converted.firstChild!.copy(converted.firstChild!.content.append(Fragment.fromArray(tail)))));
  const common = { blockId: target.node.attrs.blockId, textColor: target.node.attrs.textColor, blockBackground: target.node.attrs.blockBackground, blockIndent: target.node.attrs.blockIndent };
  const toItem = ["bulletList", "orderedList", "taskList"].includes(converted.type.name) && !["bulletList", "orderedList", "taskList"].includes(target.node.type.name);
  const node = toItem ? converted.copy(Fragment.fromArray([converted.firstChild!.type.create({ ...converted.firstChild!.attrs, ...common }, converted.firstChild!.content), ...Array.from({ length: converted.childCount - 1 }, (_, i) => converted.child(i + 1))])) : converted.type.create({ ...converted.attrs, ...common }, converted.content);
  const resolved = transaction.doc.resolve(target.pos);
  let insertedPos=target.pos;
  if (["listItem", "taskItem"].includes(target.node.type.name)) {
    const list = resolved.parent;
    const index = resolved.index();
    const before: PMNode[] = [], after: PMNode[] = [];
    list.forEach((item, _offset, itemIndex) => { if (itemIndex < index) before.push(item); if (itemIndex > index) after.push(item); });
    const replacement: PMNode[] = [];
    if (before.length) replacement.push(list.copy(Fragment.fromArray(before)));
    replacement.push(node);
    if(!listConversion)replacement.push(...tail);
    if (after.length) replacement.push(list.copy(Fragment.fromArray(after)));
    const start = resolved.before(resolved.depth);
    insertedPos=start+before.reduce((size,item)=>size+item.nodeSize,0)+(before.length?2:0);
    transaction.replaceWith(start, start + list.nodeSize, replacement);
  } else transaction.replaceWith(target.pos, target.pos + target.node.nodeSize, node);
  let textPos:number|null=node.isTextblock?insertedPos+1:null;
  if(textPos===null&&!node.isAtom)node.descendants((child,offset)=>{if(textPos!==null)return false;if(child.isTextblock){textPos=insertedPos+offset+2;return false;}return true;});
  transaction.setSelection(textPos!==null?TextSelection.create(transaction.doc,textPos):NodeSelection.create(transaction.doc,insertedPos));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
  focusAfterBlockRender(editor);
  if(node.isAtom&&typeof window!=='undefined')requestAnimationFrame(()=>{if(editor.isDestroyed)return;const dom=editor.view.nodeDOM(insertedPos);if(dom instanceof HTMLElement)dom.querySelector<HTMLElement>('.rich-source-form input:not([type=file]),.rich-page-link input')?.focus({preventScroll:true});});
}

/** Exclude lossy conversions; insertion starts from an empty paragraph. */
export function canChangeBlock(source:PMNode,type:BlockType){
  const text=source.textContent.trim();
  if(type==='divider'||type==='toc'||type==='pageLink'||type==='page')return !text;
  if(MEDIA_TYPES.includes(type as never)||type==='bookmark')return !text||Boolean(webUrl(text));
  if(type==='embed')return !text||Boolean(embedUrl(text));
  return !['toggleTitle','tableRow','tableCell','tableHeader','toggleContent'].includes(source.type.name);
}
export function insertAdjacent(editor: Editor, target: BlockTarget, above: boolean) {
  const pos = target.node.type.name==='column'?(above?target.pos+1:target.pos+target.node.nodeSize-1):above ? target.pos : target.pos + target.node.nodeSize;
  const isItem = ["listItem", "taskItem"].includes(target.node.type.name);
  const node = isItem ? { type: target.node.type.name, attrs: target.node.type.name === "taskItem" ? { checked: false } : undefined, content: [{ type: "paragraph" }] } : { type: "paragraph" };
  editor.chain().focus().command(({ tr }) => { closeHistory(tr); return true; }).insertContentAt(pos, node).setTextSelection(pos + (isItem ? 2 : 1)).run();
  return blockAt(editor, pos + (isItem ? 1 : 0));
}
function deleteBlock(editor: Editor, target: BlockTarget) {
  const resolved = editor.state.doc.resolve(target.pos);
  const onlyItem = ["listItem", "taskItem"].includes(target.node.type.name) && resolved.parent.childCount === 1;
  const from = onlyItem ? resolved.before(resolved.depth) : target.pos;
  const to = onlyItem ? from + resolved.parent.nodeSize : from + target.node.nodeSize;
  return closeHistory(editor.state.tr).delete(from, to);
}
export function actOnBlock(editor: Editor, target: BlockTarget, action: BlockAction) {
  const { pos, node } = target;
  if (action === "duplicate") { editor.chain().focus().command(({ tr }) => { closeHistory(tr); return true; }).insertContentAt(pos + node.nodeSize, (() => { const json = node.toJSON(); const clear = (item: typeof json) => { if (item.attrs) item.attrs = { ...item.attrs, blockId: null }; item.content?.forEach(clear); }; clear(json); return json; })()).run(); return; }
  if (action === "delete") { const tr = deleteBlock(editor, target), normalized = normalizeColumns(tr.doc); if (!normalized.eq(tr.doc)) tr.replaceWith(0,tr.doc.content.size,normalized.content); editor.view.dispatch(tr.scrollIntoView()); editor.commands.focus(); return; }
  const tr=planBlockMove(editor.state,target,action);if(!tr)return;
  const normalized=normalizeColumns(tr.doc);
  if(!normalized.eq(tr.doc)){
    tr.replaceWith(0,tr.doc.content.size,normalized.content);
    const id=target.node.attrs.blockId;
    if(id)tr.doc.descendants((node,at)=>{if(node.attrs.blockId===id){tr.setSelection(NodeSelection.create(tr.doc,at));return false;}});
  }
  editor.view.dispatch(closeHistory(tr).scrollIntoView());
  editor.commands.focus();
}

export function moveBlock(editor: Editor, target: BlockTarget, destination: number, indent?: number) {
  const end = target.pos + target.node.nodeSize;
  if (destination >= target.pos && destination <= end) return;
  if(target.node.type.name==='column'){
    const tr=deleteBlock(editor,target),at=tr.mapping.map(destination);tr.insert(at,target.node.content);
    const normalized=normalizeColumns(tr.doc);if(!normalized.eq(tr.doc))tr.replaceWith(0,tr.doc.content.size,normalized.content);
    editor.view.dispatch(tr);editor.commands.focus(undefined,{scrollIntoView:false});return;
  }
  const sourceIsItem = ["listItem", "taskItem"].includes(target.node.type.name);
  const destinationParent = editor.state.doc.resolve(destination).parent;
  let moving = indent === undefined ? target.node : target.node.type.create({ ...target.node.attrs, blockIndent: indent }, target.node.content);
  if (["taskList", "bulletList", "orderedList"].includes(destinationParent.type.name)) {
    const itemType = destinationParent.type.name === "taskList" ? "taskItem" : "listItem";
    const paragraphs = sourceIsItem ? moving.content : convertedBlock(editor.schema, moving, "text");
    moving = editor.schema.nodes[itemType].create({ ...moving.attrs, checked: itemType === "taskItem" ? moving.attrs.checked ?? false : undefined }, paragraphs);
  } else if (sourceIsItem) {
    moving = editor.schema.nodes[target.parentType ?? "bulletList"].create(null, moving);
  }
  if(destinationParent.type.name==='column'&&'blockIndent' in moving.attrs)moving=moving.type.create({...moving.attrs,blockIndent:0},moving.content);
  const transaction = deleteBlock(editor, target);
  const mapped = transaction.mapping.map(destination);
  transaction.insert(mapped, moving);
  const normalized = normalizeColumns(transaction.doc);
  if (!normalized.eq(transaction.doc)) transaction.replaceWith(0, transaction.doc.content.size, normalized.content);
  const selectedPos = sourceIsItem && ["bulletList", "orderedList", "taskList"].includes(moving.type.name) ? mapped + 1 : mapped;
  let selected = selectedPos;
  if (target.node.attrs.blockId) transaction.doc.descendants((node, pos) => { if (node.attrs.blockId === target.node.attrs.blockId) { selected = pos; return false; } });
  transaction.setSelection(NodeSelection.create(transaction.doc, Math.min(selected, transaction.doc.content.size - 1)));
  editor.view.dispatch(transaction);
  editor.commands.focus(undefined, { scrollIntoView: false });
}

// Collapse emptied columns after a structural move, inside the same undo step.
export function normalizeColumns(doc: PMNode): PMNode {
  const walk = (node: PMNode): PMNode[] => {
    if (node.isLeaf) return [node];
    const children: PMNode[] = []; node.forEach((child) => children.push(...walk(child)));
    if (node.type.name === "column") {
      if (!children.length || children.every((child) => child.type.name === "paragraph" && child.content.size === 0 && !child.attrs.blockId)) return [];
    }
    if (node.type.name === "columns") {
      if (children.length === 1) return Array.from({ length: children[0].childCount }, (_,i) => children[0].child(i));
      if (!children.length) return [];
    }
    return [node.copy(Fragment.fromArray(children))];
  };
  return walk(doc)[0];
}
export function moveBlockBeside(editor: Editor, source: BlockTarget, target: BlockTarget, side: "left" | "right") {
  const sourceEnd = source.pos + source.node.nodeSize, targetEnd = target.pos + target.node.nodeSize;
  if (target.pos >= source.pos && target.pos < sourceEnd || source.pos >= target.pos && source.pos < targetEnd) return;
  if (!editor.schema.nodes.columns) return;
  const unindented='blockIndent' in source.node.attrs?source.node.type.create({...source.node.attrs,blockIndent:0},source.node.content):source.node;
  const moving = ["listItem", "taskItem"].includes(source.node.type.name) ? editor.schema.nodes[source.parentType ?? "bulletList"].create(null, unindented) : unindented;
  const tr = deleteBlock(editor, source), pos = tr.mapping.map(target.pos);
  const destination = tr.doc.nodeAt(pos); if (!destination) return;
  const resolved = tr.doc.resolve(pos);
  const column = editor.schema.nodes.column.create({ width: 1 }, source.node.type.name==='column'?source.node.content:moving);
  if (resolved.parent.type.name === "column" && resolved.depth >= 2 && resolved.node(resolved.depth-1).type.name === "columns") {
    const group = resolved.node(resolved.depth-1); if (group.childCount >= MAX_COLUMNS) return;
    let weight = 0; group.forEach((child) => { weight += Number(child.attrs.width) || 1; });
    const at = side === "left" ? resolved.before() : resolved.after();
    tr.insert(at, column.type.create({ width: weight/group.childCount }, column.content));
  } else {
    const other = column.type.create({ width: 1 }, 'blockIndent' in destination.attrs?destination.type.create({...destination.attrs,blockIndent:0},destination.content):destination);
    const row = editor.schema.nodes.columns.create(null, side === "left" ? [column,other] : [other,column]);
    tr.replaceWith(pos,pos+destination.nodeSize,row);
  }
  const normalized=normalizeColumns(tr.doc); if(!normalized.eq(tr.doc)) tr.replaceWith(0,tr.doc.content.size,normalized.content);
  let selected: number | null=null;
  tr.doc.descendants((node,position) => { if (node.attrs.blockId && node.attrs.blockId === source.node.attrs.blockId) { selected=position; return false; } });
  if(selected !== null) tr.setSelection(NodeSelection.create(tr.doc,selected));
  tr.setMeta("relay-layout-move",true); editor.view.dispatch(tr); editor.commands.focus(undefined,{scrollIntoView:false});
}
