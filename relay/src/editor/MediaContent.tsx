"use client";
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';
import {BlockGlyph} from './block-preview';
import { embedUrl, webUrl, type AssetRecord, type EditorResources } from '../domain/blocks/rich-content';
export type MediaAttrs = {src?: string; url?: string; assetId?: string; name?: string; caption?: string; width?: number; type?: string; size?: number};
export function MediaContent({kind,attrs,resources,publicId}:{kind:string;attrs:MediaAttrs;resources?:EditorResources;publicId?:string}) {
  const t = useTranslations('editorTools.rich');
  const [loaded,setLoaded] = useState<{key:string;url:string}|null>(null), [failed,setFailed] = useState(false), [attempt,setAttempt] = useState(0);
  const key = attrs.assetId ?? '', request = resources?.request;
  const requestRef=useRef(request);requestRef.current=request;
  useEffect(() => {
    const load=requestRef.current;if (!key || !load) return;
    let cancelled = false, url = '';
    load<AssetRecord>(`?assetId=${encodeURIComponent(key)}`).then(file => {
      if (cancelled) return;
      const bytes = Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
      const type=/^(image\/(png|jpeg|gif|webp|avif)|video\/|audio\/|application\/pdf$)/.test(file.type)?file.type:'application/octet-stream';
      url = URL.createObjectURL(new Blob([bytes],{type})); setLoaded({key,url}); setFailed(false);
    }).catch(() => {if (!cancelled) setFailed(true);});
    return () => {cancelled = true; if(url) URL.revokeObjectURL(url);};
  },[key,attempt]);
  const src = key ? publicId ? `/api/v1/public/${encodeURIComponent(publicId)}/assets/${encodeURIComponent(key)}` : loaded?.key===key?loaded.url:null : webUrl(attrs.src||attrs.url);
  if (!src) return key ? <div className="rich-media-status">{failed?<><span>{t('loadFailed')}</span><button type="button" onClick={()=>setAttempt(n=>n+1)}>{t('retry')}</button></>:t('loading')}</div> : null;
  if (kind === 'image') return <img className="rich-image" src={src} alt={attrs.caption || attrs.name || ''} loading="lazy" />;
  if (kind === 'video') return <video src={src} controls preload="metadata" />;
  if (kind === 'audio') return <audio src={src} controls preload="metadata" />;
  if (kind === 'pdf') return <>{key?<iframe src={src} className="rich-pdf" title={attrs.name || 'PDF'} />:null}<a href={src} target="_blank" rel="noopener noreferrer">{t('openFile')}</a></>;
  if (kind === 'embed') {const url=embedUrl(src);return url?<iframe src={url} title={attrs.name||t('embed')} sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="fullscreen; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>:null;}
  if (kind === 'bookmark') return <a href={src} target="_blank" rel="noopener noreferrer" className="rich-bookmark"><span className="rich-file-icon" aria-hidden><BlockGlyph type="link"/></span><span><strong>{attrs.name || new URL(src).hostname}</strong><small>{src}</small></span></a>;
  return <a href={src} download={attrs.name || true} target="_blank" rel="noopener noreferrer" className="rich-file"><span className="rich-file-icon" aria-hidden><BlockGlyph type="file"/></span><span>{attrs.name || t('file')}{attrs.size?<small>{attrs.size<1024*1024?`${Math.max(1,Math.round(attrs.size/1024))} KB`:`${(attrs.size/1024/1024).toFixed(1)} MB`}</small>:null}</span></a>;
}
