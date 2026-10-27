export type PageLayoutInput = {
  viewportLeft: number; viewportRight: number;
  contentLeft: number; contentRight: number;
  mode: 'normal' | 'compact' | 'zen'; annotations: boolean;
};
export type PageLayout = { left: number; width: number; side: boolean; wide:boolean; cardWidth: number; gap: number; menuWidth: number };

/** Work in CSS viewport pixels: Windows DPI affects available space, not just text. */
export function pageLayout(input: PageLayoutInput): PageLayout {
  const viewportWidth=input.viewportRight-input.viewportLeft;
  const preferredMenuWidth=Math.min(280,Math.max(240,viewportWidth-800));
  const cardWidth=288;
  const gap=56;
  const right=Math.min(input.contentRight,input.viewportRight-20);
  const controls=64,edge=16;
  const minimumLeft=input.contentLeft+controls;
  // Comments use the canvas width, not a reservation for a transient block menu.
  const side=input.annotations&&right-minimumLeft-gap-cardWidth>=720;
  const menuAt=(left:number)=>{
    const available=left-input.viewportLeft-44-8-edge;
    return {wide:available>=240,menuWidth:available>=240?Math.min(280,available):preferredMenuWidth};
  };
  if(side){
    const width=720;
    const lastLeft=right-width-gap-cardWidth;
    const centered=(input.contentLeft+right-width)/2;
    const desired=input.mode==='normal'?(input.contentLeft+right-width-gap-cardWidth)/2+64:centered;
    const left=Math.max(minimumLeft,Math.min(desired,lastLeft));
    return {left,width,side,...menuAt(left),cardWidth,gap};
  }
  // Narrow pages reserve a small indicator gutter, never space below the text.
  const textRight=right-(input.annotations?56:16);
  const leftFloor=input.contentLeft+controls;
  const width=Math.min(720,Math.max(80,textRight-leftFloor));
  const centered=(input.contentLeft+textRight-width)/2;
  const left=Math.max(leftFloor,Math.min(centered,textRight-width));
  return {left,width,side:false,...menuAt(left),cardWidth:Math.min(cardWidth,Math.max(180,right-input.contentLeft-16)),gap};
}
