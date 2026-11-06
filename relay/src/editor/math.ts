import katex from 'katex';
export function mathHTML(latex:string,displayMode=true) {return katex.renderToString(latex.slice(0,4000),{displayMode,throwOnError:false,trust:false,maxExpand:200,maxSize:20,strict:'ignore'});}
