import {readCommentDrafts} from './comment-drafts';

/** Restore only for programmatic focus; a pointer click keeps its chosen caret. */
export function focusCommentInput(input:HTMLTextAreaElement){
  if(document.activeElement===input)return;
  const host=input.closest<HTMLElement>('[data-composer-key]');
  const saved=host?.dataset.draftScope?readCommentDrafts(host.dataset.draftScope).find(item=>item.key===host.dataset.composerKey)?.selection:undefined;
  const length=input.value.length;
  const start=saved&&Number.isFinite(saved.start)?Math.max(0,Math.min(length,saved.start)):length;
  const end=saved&&Number.isFinite(saved.end)?Math.max(start,Math.min(length,saved.end)):start;
  input.focus({preventScroll:true});
  input.setSelectionRange(start,end,saved?.direction==='backward'?'backward':'forward');
}
