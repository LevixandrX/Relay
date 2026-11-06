/** Portable AST/URL rules shared by API, editor and public renderer. */
export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_PAGE_ASSET_BYTES = 200 * 1024 * 1024;
export const MEDIA_TYPES = ['image', 'video', 'audio', 'file', 'pdf'] as const;
export type MediaKind = typeof MEDIA_TYPES[number];
export const RICH_BLOCKS = ['toggle','table','image','video','audio','file','pdf','bookmark','embed','equation','tableOfContents','pageLink'];
export function webUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4000) return null;
  try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function embedUrl(value: unknown): string | null {
  const valid = webUrl(value); if (!valid) return null;
  const url = new URL(valid), host = url.hostname.replace(/^www\./,'');
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return id && /^[\w-]{6,30}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') { const id = url.pathname.match(/(?:video\/)?(\d+)$/)?.[1]; return id ? `https://player.vimeo.com/video/${id}` : null; }
  if (host === 'loom.com') { const id = url.pathname.match(/^\/(?:share|embed)\/([a-zA-Z0-9-]+)$/)?.[1]; return id ? `https://www.loom.com/embed/${id}` : null; }
  if (host === 'figma.com' && /^\/(?:file|design|proto)\//.test(url.pathname)) return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(valid)}`;
  if (host === 'figma.com' && url.pathname === '/embed') { const nested = webUrl(url.searchParams.get('url')),nestedHost=nested?new URL(nested).hostname.replace(/^www\./,''):'';return nestedHost==='figma.com' ? valid : null; }
  return null;
}
export function mediaKind(type: string): MediaKind { return /^image\/(png|jpeg|gif|webp|avif)$/.test(type) ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : type === 'application/pdf' ? 'pdf' : 'file'; }
export type AssetRecord = { id: string; name: string; type: string; size: number; data: string };
export type ResourcePage = { id: string; title: string; icon?: string | null };
export type EditorResources = { pageId?:string;saveText?:(name:string,text:string)=>Promise<'saved'|'cancelled'>;request: <T>(suffix: string, init?: RequestInit) => Promise<T>; openPage: (id: string) => void; createPage?: (title:string)=>Promise<ResourcePage>;moveBlock?:(targetPageId:string,blockId:string,content:import('./schema').Doc)=>Promise<import('./schema').Doc> };

/** Account for cells covered by row spans, including completely covered rows. */
export function validTable(rows:{content?:{attrs?:Record<string,unknown>}[]}[]){
  let width=0;const spans:number[]=[];
  for(let row=0;row<rows.length;row++){
    let column=0;
    for(const cell of rows[row].content??[]){
      while(spans[column]>0)column++;
      const colspan=Number(cell.attrs?.colspan??1),rowspan=Number(cell.attrs?.rowspan??1);
      if(!Number.isInteger(colspan)||!Number.isInteger(rowspan)||colspan<1||rowspan<1||column+colspan>50||row+rowspan>rows.length)return false;
      for(let i=column;i<column+colspan;i++){if(spans[i]>0)return false;spans[i]=rowspan;}
      column+=colspan;
    }
    if(row===0)width=spans.length;
    if(!width||spans.length!==width||spans.some(n=>!n||n<0))return false;
    for(let i=0;i<spans.length;i++)spans[i]--;
  }
  return spans.every(n=>n===0);
}
