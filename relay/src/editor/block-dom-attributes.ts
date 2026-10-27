import type {Node} from '@tiptap/pm/model';

/** Keep custom column node views in sync with the shared block attributes. */
export function syncBlockDom(dom:HTMLElement,node:Node){
  for(const [attr,name,variable] of [['blockId','data-block-id',''],['blockIndent','data-block-indent','--block-indent'],['textColor','data-text-color','--block-text'],['blockBackground','data-block-background','--block-bg']] as const){
    const value=node.attrs[attr];
    if(value!=null&&value!==0){dom.setAttribute(name,String(value));if(variable)dom.style.setProperty(variable,String(value));}
    else {dom.removeAttribute(name);if(variable)dom.style.removeProperty(variable);}
  }
  if(node.attrs.blockId)dom.id=node.attrs.blockId;else dom.removeAttribute('id');
}
