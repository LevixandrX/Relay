"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {OverlayPresence,OverlaySurface,isTopEditorOverlay} from './EditorOverlay';
import {ImagePlus,Search,ClipboardPaste} from 'lucide-react';
import {pickerPosition} from './picker-position';
import {pastedImage,readClipboardImage,type ClipboardImage} from './image-clipboard';
import {imageFromUrl} from './image-from-url';
import {RichPopover,type PopoverAnchor} from './RichPopover';
import { useTranslations,useLocale } from "use-intl";
import {emojiName} from '../lib/emoji-names';
import { EMOJI_GROUPS, EMOJI_KEYWORDS, type CustomEmoji } from "../lib/emoji";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import { BlockGlyph } from "./block-preview";
export function EmojiImage({ value, custom }: { value: string; custom: CustomEmoji[] }) {
  const emoji = value.startsWith("custom:") ? custom.find((e) => e.id === value.slice(7)) : null;
  return emoji ? <img className="editor-custom-emoji-image" src={`data:image/png;base64,${emoji.data}`} alt={`:${emoji.name}:`} /> : <span>{value.startsWith("custom:") ? "◻" : value}</span>;
}
export function EmojiPicker({ anchor, custom, identity, busy, onPick, onUpload, onClose,allowCustom=true,label,topbar,panel,extraSearch,suggestions,className='',owner:parentOwner,placementAnchor,blockAnchor,blockEnd=false,focusPanel=false,avoidAnchor=false,alignStart=false,onPaste }: { anchor: HTMLElement; custom: CustomEmoji[]; identity: string; busy: boolean; onPick: (value: string) => void; onUpload: (name: string, data: string) => Promise<boolean>; onClose: () => void;allowCustom?:boolean;label?:string;topbar?:ReactNode;panel?:ReactNode;extraSearch?:ReactNode;suggestions?:{label:string;values:string[]};className?:string;owner?:string;placementAnchor?:PopoverAnchor;blockAnchor?:PopoverAnchor;blockEnd?:boolean;focusPanel?:boolean;avoidAnchor?:boolean;alignStart?:boolean;onPaste?:React.ClipboardEventHandler<HTMLDivElement> }) {
  const localOwner=useId(),owner=parentOwner??localOwner;
  const [addAnchor,setAddAnchor]=useState<HTMLElement|null>(null);
  const t = useTranslations("editorTools.emoji");
  const locale=useLocale();
  const root = useRef<HTMLDivElement>(null), file = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""), [group, setGroup] = useState("recent"), [adding, setAdding] = useState(false), [name, setName] = useState(""), [image, setImage] = useState(""), [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false), generation = useRef(0);
  const pendingCategory = useRef<string | null>(null);
  const cancelAdding = () => { generation.current++; setAdding(false); setImage(""); setName(""); setError(""); setPreparing(false); if (file.current) file.current.value = ""; };
  const [preview, setPreview] = useState<{ value: string; label: string; left: number; top: number } | null>(null);
  const press = useRef<{ timer: number; held: boolean; x: number; y: number; pointerId: number } | null>(null), suppressClick = useRef(false);
  const previewEntry = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    setPreview({ value: button.dataset.emojiValue!, label: button.getAttribute('aria-label') ?? '', left: Math.max(12, Math.min(rect.left + rect.width/2 - 64, window.innerWidth - 140)), top: Math.max(12, Math.min(rect.top - 146, window.innerHeight - 156)) });
  };
  const release = () => { if (press.current) { window.clearTimeout(press.current.timer); if (press.current.held) suppressClick.current = true; } press.current = null; setPreview(null); };
  useEffect(() => { window.addEventListener('blur',release); return () => { window.removeEventListener('blur',release); if (press.current) window.clearTimeout(press.current.timer); }; }, []);
  const [position, setPosition] = useState({ left: 12, top: 12,maxHeight:window.innerHeight-24 });
  const [recent, setRecent] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(`relay-emoji-recent:${identity}`) ?? "[]"); } catch { return []; } });
  useLayoutEffect(()=>{if(focusPanel)root.current?.focus({preventScroll:true});},[focusPanel]);
  useLayoutEffect(() => {
    const place=()=>{const r=(placementAnchor??anchor).getBoundingClientRect(),w=root.current?.offsetWidth??360,upload=root.current?.querySelector<HTMLElement>('.rich-callout-upload-scroll>.overlay-scroll-target'),h=(root.current?.scrollHeight??380)+(upload?Math.max(0,upload.scrollHeight-upload.clientHeight):0),below=innerHeight-r.bottom-20,above=r.top-20,down=below>=Math.min(h,380)||below>=above;
      const maxHeight=avoidAnchor?Math.max(140,down?below:above):innerHeight-24,top=avoidAnchor?(down?r.bottom+8:r.top-Math.min(h,maxHeight)-8):Math.min(r.bottom+8,innerHeight-h-12);
      const next=blockAnchor?pickerPosition(r,w,h,{width:innerWidth,height:innerHeight},blockAnchor.getBoundingClientRect(),blockEnd):{left:Math.max(12,Math.min(alignStart?r.left:r.right-w,innerWidth-w-12)),top:Math.max(12,top),maxHeight};setPosition(old=>old.left===next.left&&old.top===next.top&&old.maxHeight===next.maxHeight?old:next);
    };
    place(); const observer = new ResizeObserver(place); if (root.current) observer.observe(root.current);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor,panel,placementAnchor,avoidAnchor,alignStart,blockAnchor,blockEnd]);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (e.target instanceof Node && !root.current?.contains(e.target) && !anchor.contains(e.target)&&!(e.target instanceof Element&&e.target.closest('[data-editor-menu-owner]')?.getAttribute('data-editor-menu-owner')===owner)) onClose(); };
    const keyboard = (e: KeyboardEvent) => { if (e.key === "Escape" && isTopEditorOverlay(root.current)) { e.preventDefault(); e.stopImmediatePropagation(); if (adding) cancelAdding(); else { onClose(); anchor.focus(); } } };
    document.addEventListener("pointerdown", outside, true); window.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", keyboard, true); };
  }, [anchor, adding, onClose,owner]);
  useEffect(() => () => { generation.current++; }, []);
  const choose = (value: string) => { const next = [value, ...recent.filter((v) => v !== value)].slice(0, 24); try { localStorage.setItem(`relay-emoji-recent:${identity}`, JSON.stringify(next)); } catch { /* Picking still works when storage is unavailable. */ } setRecent(next); onPick(value); };
  const groups = useMemo(()=>[...EMOJI_GROUPS.map((g) => ({ id: g.id, label: t(g.id), values: g.values.split(" ").map((value) => ({ value, label: `${value} ${t(g.id)} ${EMOJI_KEYWORDS.get(value) ?? ""}` })) })), { id: "custom", label: t("custom"), values: custom.map((e) => ({ value: `custom:${e.id}`, label: e.name })) }],[custom,t]);
  const filtered = query.trim().toLocaleLowerCase();
  const visible = useMemo(()=>filtered ? groups.map((g) => ({ ...g, values: g.values.filter((v) => v.label.toLocaleLowerCase().includes(filtered)) })) : [{ id: "recent", label: t("recent"), values: (recent.length ? recent : ["👍", "❤️", "🎉", "👀", "✅", "💡"]).filter((v) => !v.startsWith("custom:") || custom.some((c) => `custom:${c.id}` === v)).map((value) => ({ value, label: value })) }, ...(suggestions?[{id:"callout",label:suggestions.label,values:suggestions.values.map(value=>({value,label:value}))}]:[]),...groups],[filtered,groups,recent,suggestions,custom,t]);
  const navigate = (category: string) => {
    pendingCategory.current = category; setQuery(""); setGroup(category);
    requestAnimationFrame(() => {
      const port = root.current?.querySelector<HTMLElement>('.editor-emoji-scroll > .overlay-scroll-target');
      const section = root.current?.querySelector<HTMLElement>(`[data-emoji-category="${category}"]`);
      if (port && section) { port.scrollTo({top:port.scrollTop+section.getBoundingClientRect().top-port.getBoundingClientRect().top,behavior:'instant'}); pendingCategory.current = null; }
    });
  };
  useLayoutEffect(() => {
    const port = root.current?.querySelector<HTMLElement>('.editor-emoji-scroll > .overlay-scroll-target');
    if (!port || filtered || adding) return;
    let frame=0;const updateNow = () => {
      if (pendingCategory.current) return;
      const sections = Array.from(port.querySelectorAll<HTMLElement>('[data-emoji-category]'));
      const edge = port.getBoundingClientRect().top + 16;
      const current = port.scrollTop + port.clientHeight >= port.scrollHeight - 2 ? sections.at(-1) : sections.filter((s)=>s.getBoundingClientRect().top<=edge).at(-1) ?? sections[0];
      if (current) setGroup(current.dataset.emojiCategory!);
    };
    const update=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;updateNow();});};
    const size = () => { const value=`${port.clientHeight}px`; if(port.style.getPropertyValue('--emoji-view-height')!==value)port.style.setProperty('--emoji-view-height',value); };
    size();const observer=new ResizeObserver(size);observer.observe(port);
    port.addEventListener('scroll',update,{passive:true});
    return () => {cancelAnimationFrame(frame);observer.disconnect();port.removeEventListener('scroll',update);};
  }, [adding, filtered]);
  const prepare = async (selected: File | undefined) => {
    if (!selected) return; const token = ++generation.current; setPreparing(true); setError("");
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) || selected.size > 2 * 1024 * 1024) throw new Error();
      const bitmap = await createImageBitmap(selected); const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!; const scale = Math.min(64 / bitmap.width, 64 / bitmap.height); const w = bitmap.width * scale, h = bitmap.height * scale;
      ctx.drawImage(bitmap, (64 - w) / 2, (64 - h) / 2, w, h); bitmap.close();
      const data = canvas.toDataURL("image/png").split(",")[1]; if (data.length > 43692) throw new Error();
      if (generation.current === token) { setImage(data); if (!name) setName(selected.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]/gu, "-").slice(0, 40)); }
    } catch { if (generation.current === token) setError(t("fileError")); }
    finally { if (generation.current === token) setPreparing(false); }
  };
  const paste=async(value:ClipboardImage)=>{if(value instanceof File){await prepare(value);return;}const version=++generation.current;setPreparing(true);try{const file=await imageFromUrl(value);if(generation.current===version)await prepare(file);}catch{if(generation.current===version){setPreparing(false);setError(t('fileError'));}}};
  const pasteButton=async()=>{const version=++generation.current;try{const value=await readClipboardImage();if(version===generation.current)void paste(value);}catch{if(version===generation.current)setError(t('clipboardError'));}};
  const customForm=(<div className="editor-emoji-add" data-popover-focus tabIndex={-1} onPaste={event=>{const value=pastedImage(event.clipboardData);if(value){event.preventDefault();event.stopPropagation();void paste(value);}}}>
      <strong>{t("add")}</strong><p>{t("shared")}</p>
      {image ? <div className="editor-emoji-upload-preview"><span>{t('preview')}</span><div><span data-surface="dark"><img src={`data:image/png;base64,${image}`} alt="" /></span><span data-surface="light"><img src={`data:image/png;base64,${image}`} alt="" /></span></div><button type="button" disabled={preparing||busy} onClick={()=>file.current?.click()}><BlockGlyph type="replace"/>{t('replace')}</button></div> : <><button type="button" className="editor-emoji-upload" disabled={preparing||busy} onClick={() => file.current?.click()}><ImagePlus aria-hidden/>{t("upload")}</button><button type="button" className="rich-icon-paste-button" disabled={preparing||busy} onClick={()=>void pasteButton()}><ClipboardPaste/>{t('paste')}</button></>}
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void prepare(e.target.files?.[0]); e.target.value = ""; }} />
      <label>{t("name")}<input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>
      {error ? <p role="alert">{error}</p> : null}
      <footer className="rich-picker-actions"><button type="button" onClick={()=>image?(()=>{generation.current++;setImage('');setName('');setError('');setPreparing(false);})():cancelAdding()}>{t(image?'back':'cancel')}</button><button type="button" disabled={busy || preparing || !image || !/^[\p{L}\p{N}_-]{1,40}$/u.test(name)} onClick={() => { const token=++generation.current; void onUpload(name, image).then((ok) => { if(token!==generation.current)return; if (ok) { cancelAdding(); navigate("custom"); } else setError(t("saveError")); }); }}>{t("save")}</button></footer>
    </div>);
  const sectionContent=useMemo(()=>(<div className="editor-emoji-sections">
        {visible.filter(g=>allowCustom||g.id!=='custom').map((g) => g.values.length || g.id==='custom' && !filtered ? <section key={g.id} data-emoji-category={g.id} style={{'--emoji-section-size':(27+Math.ceil((g.values.length+(g.id==='custom'?1:0))/9)*35)+'px'} as CSSProperties}>
          <h4>{g.label}</h4>
          <div className="editor-emoji-grid">{g.id==='custom' && !filtered ? <button type="button" className="editor-emoji-custom-add" aria-label={t('add')} title={t('add')} onClick={event=>{setAddAnchor(event.currentTarget);setAdding(true);}}><BlockGlyph type="add"/></button> : null}{g.values.map((entry) => <button type="button" key={entry.value} data-emoji-value={entry.value} title={entry.value.startsWith('custom:')?entry.label:emojiName(entry.value,locale)} aria-label={entry.value.startsWith('custom:')?entry.label:emojiName(entry.value,locale)} disabled={busy}
            onPointerDown={(e)=>{ if(e.button!==0)return; release(); suppressClick.current=false; const button=e.currentTarget; button.setPointerCapture(e.pointerId); press.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId,held:false,timer:window.setTimeout(()=>{if(press.current){press.current.held=true;previewEntry(button);}},300)}; }}
            onPointerMove={(e)=>{const current=press.current;if(!current||current.pointerId!==e.pointerId)return;if(!current.held){if(Math.hypot(e.clientX-current.x,e.clientY-current.y)>8)window.clearTimeout(current.timer);return;}const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLButtonElement>('button[data-emoji-value]');if(target&&!target.disabled)previewEntry(target);}}
            onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
            onClick={() => {if(suppressClick.current){suppressClick.current=false;return;}choose(entry.value);}}><EmojiImage value={entry.value} custom={custom} /></button>)}</div>
        </section> : null)}
        {!visible.some((g) => g.values.length) && Boolean(filtered||!allowCustom) ? <p className="editor-comment-status">{t("empty")}</p> : null}
      </div>),[visible,allowCustom,filtered,busy,custom,locale,t]);
  return createPortal(<><OverlaySurface surfaceRef={root} tabIndex={-1} blockLevel={116} owner={owner} data-editor-menu-owner={owner} className={`editor-emoji-picker ${className}`} onPaste={onPaste} data-adding={adding} style={position} role="dialog" aria-label={label??t("title")} onKeyDown={(e) => {
    if (adding || panel || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>(".editor-emoji-grid button:not(:disabled)") ?? []);
    const current = buttons.indexOf(e.target as HTMLButtonElement);
    if (current < 0 && e.key !== "ArrowDown") return;
    if (!buttons.length) return;
    e.preventDefault(); e.stopPropagation();
    const step = e.key === "ArrowDown" ? 9 : e.key === "ArrowUp" ? -9 : e.key === "ArrowRight" ? 1 : -1;
    const index = current < 0 || e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, current + step));
    const button = buttons[index]; button.focus({ preventScroll: true });
    const port = button.closest<HTMLElement>(".overlay-scroll-target"), r = button.getBoundingClientRect(), p = port?.getBoundingClientRect();
    if (port && p) { if (r.top < p.top) port.scrollTop += r.top - p.top; else if (r.bottom > p.bottom) port.scrollTop += r.bottom - p.bottom; }
  }}>
    {topbar}
    {panel??(<>
      <div className="editor-emoji-search"><label className="rich-search-field"><Search aria-hidden/><input autoFocus aria-label={t("search")} placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} /></label>{extraSearch}</div>
      <OverlayScroll className="editor-emoji-scroll">{sectionContent}</OverlayScroll>
      <nav aria-label={t("categories")}><button type="button" aria-label={t("recent")} title={t("recent")} data-active={group === "recent"} onClick={() => navigate("recent")}>◷</button>{EMOJI_GROUPS.map((g) => <button type="button" key={g.id} aria-label={t(g.id)} title={t(g.id)} data-active={group === g.id} onClick={() => navigate(g.id)}>{g.icon}</button>)}{allowCustom?<><button type="button" aria-label={t("custom")} title={t("custom")} data-active={group === "custom"} onClick={() => navigate("custom")}><BlockGlyph type="customEmoji" /></button><button type="button" aria-label={t("add")} title={t("add")} onClick={event=>{setAddAnchor(event.currentTarget);setAdding(true);}}><BlockGlyph type="add"/></button></>:null}</nav>
    </>)}
  </OverlaySurface><OverlayPresence visible={adding}>{adding&&addAnchor?<RichPopover initialFocus="container" scrollContent dismissOnPointerLeave={false} anchor={addAnchor} owner={owner} width={320} level={118} side="right" className="editor-emoji-custom-popover" label={t("add")} onClose={cancelAdding}>{customForm}</RichPopover>:null}</OverlayPresence>{preview ? <aside className="editor-emoji-preview relay-tooltip-surface" style={{left:preview.left,top:preview.top}} role="tooltip"><EmojiImage value={preview.value} custom={custom}/><span>{preview.label}</span></aside> : null}</>, document.body);
}
