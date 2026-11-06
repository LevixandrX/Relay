import type {Editor} from '@tiptap/core';

/** Presentation grouping only: each discussion keeps its own persistent block ID. */
export function commentRow(editor:Editor,blockId:string){
  const block=editor.view.dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
  let columns=block?.closest<HTMLElement>('[data-type="columns"]')??null;
  while(columns?.parentElement?.closest('[data-type="columns"]'))columns=columns.parentElement.closest<HTMLElement>('[data-type="columns"]');
  if(columns&&editor.view.dom.contains(columns)){
    const blockIds=[...new Set([...(columns.dataset.blockId?[columns.dataset.blockId]:[]),...Array.from(columns.querySelectorAll<HTMLElement>('[data-block-id]'),node=>node.dataset.blockId!)])];
    return {blockId:blockIds[0]??blockId,blockIds,element:columns};
  }
  const callout=block?.closest<HTMLElement>('.node-callout')??block?.closest<HTMLElement>('[data-type=callout]');
  const first=callout?.querySelector<HTMLElement>('.rich-callout-content [data-block-id]');
  if(callout&&(block===callout||block===first)){
    const blockIds=[callout.dataset.blockId,first?.dataset.blockId].filter((id):id is string=>Boolean(id));
    return {blockId:blockIds[0]??blockId,blockIds,element:first??callout};
  }
  return {blockId,blockIds:[blockId],element:block};
}
