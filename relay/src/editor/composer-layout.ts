/** Keep the caret line in view without moving to the end of another discussion. */
export function revealCommentCaret(port:HTMLElement,input:HTMLTextAreaElement){
  const field=input.getBoundingClientRect(),view=port.getBoundingClientRect();
  const offset=Number(input.dataset.caretTop)||8,line=Number(input.dataset.caretHeight)||20;
  const footer=input.selectionEnd===input.value.length?Math.max(0,(input.closest('.editor-comment-compose-field')?.getBoundingClientRect().bottom??field.bottom)-field.bottom):0;
  const top=field.top+offset-input.scrollTop,bottom=top+line+footer+8;
  if(bottom>view.bottom-12)port.scrollTop+=bottom-view.bottom+12;
  else if(top<view.top+12)port.scrollTop+=top-view.top-12;
}

/** Measure wrapping at the real text width, never at a temporary narrower width. */
export function measureCommentInput(input:HTMLTextAreaElement,mirror:HTMLDivElement){
  const style=getComputedStyle(input),width=input.getBoundingClientRect().width;
  Object.assign(mirror.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',pointerEvents:'none',boxSizing:'border-box',width:`${width}px`,font:style.font,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,padding:style.padding,whiteSpace:'pre-wrap',overflowWrap:'break-word',wordBreak:'break-word',border:'0',minHeight:'0'});
  const caret=document.createElement('span'),position=input.selectionDirection==='backward'?input.selectionStart:input.selectionEnd;
  caret.textContent='\u200b';
  mirror.replaceChildren(document.createTextNode(input.value.slice(0,position)),caret,document.createTextNode(input.value.slice(position)+'\u200b'));
  const line=parseFloat(style.lineHeight)||20,height=Math.max(36,Math.ceil(mirror.getBoundingClientRect().height));
  input.dataset.caretTop=String(caret.getBoundingClientRect().top-mirror.getBoundingClientRect().top);
  input.dataset.caretHeight=String(line);
  return {height,line,singleHeight:line+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)};
}
