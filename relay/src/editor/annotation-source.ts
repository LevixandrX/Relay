const sources=new WeakMap<HTMLElement,HTMLElement>();
export function bindAnnotationSource(canvas:HTMLElement,source:HTMLElement){sources.set(canvas,source);return()=>sources.delete(canvas);}
export function annotationSource(element:HTMLElement){const canvas=element.closest<HTMLElement>('[data-editor-annotations-canvas]');return canvas?sources.get(canvas)??null:null;}
