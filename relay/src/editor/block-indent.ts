import type {Editor} from '@tiptap/core';
import {closeHistory} from '@tiptap/pm/history';
import {sinkListItem,liftListItem} from '@tiptap/pm/schema-list';
import {blockAt} from './block-commands';

/** Tab edits the document; at either limit it still keeps focus in the text. */
export function indentEditorSelection(editor:Editor,direction:1|-1){
  if(!editor.isEditable)return false;
  const {state,view}=editor,{$from,$to,from,to,empty}=state.selection;
  let inTable=false;for(let depth=$from.depth;depth>0;depth--)if($from.node(depth).type.name==='table')inTable=true;
  if(inTable){
    if(direction===-1)return editor.commands.goToPreviousCell()||true;
    if(editor.commands.goToNextCell())return true;
    for(let d=$from.depth;d>0;d--)if($from.node(d).type.name==='table'&&$from.node(d).childCount>=100)return true;
    return editor.chain().addRowAfter().goToNextCell().run()||true;
  }
  if($from.parent.type.name==='codeBlock'&&$from.sameParent($to)){
    const tr=closeHistory(state.tr),start=$from.start(),text=$from.parent.textContent;
    if(direction===1&&empty)tr.insertText('\t',from,to);
    else{
      const first=$from.parentOffset?text.lastIndexOf('\n',$from.parentOffset-1)+1:0;
      const last=empty?$from.parentOffset:$to.parentOffset-(text[$to.parentOffset-1]==='\n'?1:0);
      const lines:number[]=[];for(let at=first;at<=last;){lines.push(at);const next=text.indexOf('\n',at);if(next<0||next>=last)break;at=next+1;}
      for(const at of lines.reverse()){
        if(direction===1)tr.insertText('\t',start+at);
        else {const leading=text.slice(at).match(/^(?:\t| {1,4})/)?.[0].length??0;if(leading)tr.delete(start+at,start+at+leading);}
      }
    }
    if(tr.docChanged)view.dispatch(tr.scrollIntoView());
    return true;
  }
  const current=blockAt(editor,from),indent=Number(current?.node.attrs.blockIndent)||0;
  const item=['listItem','taskItem'].includes(current?.node.type.name??'')?current?.node.type:undefined;
  if(item&&(direction===1||indent===0)){
    const command=direction===1?sinkListItem(item):liftListItem(item);
    if(command(state,tr=>view.dispatch(closeHistory(tr).scrollIntoView())))return true;
  }
  const tr=closeHistory(state.tr);
  const apply=(pos:number)=>{const node=state.doc.nodeAt(pos);if(!node||!('blockIndent' in node.attrs))return;const value=Math.max(0,Math.min(8,(Number(node.attrs.blockIndent)||0)+direction));if(value!==node.attrs.blockIndent)tr.setNodeMarkup(pos,undefined,{...node.attrs,blockIndent:value});};
  if(empty){if(current)apply(current.pos);}
  else state.doc.nodesBetween(from,to,(node,pos)=>{if('blockIndent' in node.attrs){apply(pos);return false;}return true;});
  if(tr.docChanged)view.dispatch(tr.scrollIntoView());
  return true;
}
