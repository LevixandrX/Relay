/** Keep horizontal gestures on the block, including its separate scroll rail. */
export function bindHorizontalScroll(surface:HTMLElement,port:HTMLElement){
  let frame=0,pending=0;
  const wheel=(event:WheelEvent)=>{
    if(event.ctrlKey||event.defaultPrevented||port.scrollWidth<=port.clientWidth+1)return;
    const rail=event.target instanceof Element&&event.target.closest('.rail-scroll[data-axis=horizontal]');
    const delta=event.shiftKey||rail?(event.deltaX||event.deltaY):Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:0;
    if(!delta)return;event.stopPropagation();
    // Let Chromium's compositor own touchpad scrolling over the actual port.
    if(event.target instanceof Node&&port.contains(event.target)&&!event.shiftKey)return;
    event.preventDefault();pending+=delta*(event.deltaMode===1?16:event.deltaMode===2?port.clientWidth:1);
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;port.scrollLeft+=pending;pending=0;});
  };
  surface.addEventListener('wheel',wheel,{passive:false});return()=>{cancelAnimationFrame(frame);surface.removeEventListener('wheel',wheel);};
}
