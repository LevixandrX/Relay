"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { useLocale, useTranslations } from "use-intl";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import { EmojiPicker } from "./EmojiPicker";
import { BlockGlyph } from "./block-preview";
import { blockAt } from "./block-commands";
import { editorCanvas } from "./use-editor-canvas";
import { blockGeometry, editorClipRect } from "./use-block-handles";
import { commentThreadAt, setCommentAnchors } from "./comment-anchor";
import { CommentComposer } from "./CommentComposer";
import { CommentAvatar } from "./CommentAvatar";
import { CommentCard } from "./CommentCard";
import {EditorAnnotations} from './EditorAnnotations';
import {CommentActionTooltip} from './CommentActionTooltip';
import { CommentBlockPopover } from "./CommentBlockPopover";
import { CommentReaction } from "./CommentReaction";
import { CommentMessageMenu } from "./CommentMessageMenu";
import {OverlayPresence,OverlaySurface} from "./EditorOverlay";
import {editorControlZone,editorControlBridge} from './editor-control-zones';
import {editorControlsBlocked} from './use-editor-controls';
import { commentTime } from "./comment-time";
import { DateLabel } from '../components/DateLabel';
import { useCommentLayout } from "./use-comment-layout";
import {commentRow} from './comment-rows';
import { commentDraftScope, emptyCommentDraft, hasCommentDraft, newCommentDraftKey, readCommentDrafts, removeCommentDraft, saveCommentDraft } from "./comment-drafts";
import type { CommentCommand, CommentContext, CommentData, CommentDraft, CommentMessage, CommentThread, DraftAnchor, FileUpload } from "./comment-types";
export type { DraftAnchor } from "./comment-types";

export function BlockComments({ editor, context, editable, anchor, onCloseDraft, onAddComment, onPeople,controlsVisible=false }: {
  editor: Editor; context: CommentContext; editable: boolean; anchor: DraftAnchor | null;
  onCloseDraft: () => void; onAddComment?: (target: ReturnType<typeof blockAt>) => void;
  onPeople?:(people:CommentData['people'])=>void;
  controlsVisible?:boolean;
}) {
  const t = useTranslations("editorTools.comments"), locale = useLocale();
  const scope = commentDraftScope(context.identity, context.pageId);
  const [data, setData] = useState<CommentData | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [list, setList] = useState(false), [showResolved, setShowResolved] = useState(false);
  const [drafts, setDrafts] = useState(() => editable ? readCommentDrafts(scope).filter((d) => d.anchor) : []);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [more, setMore] = useState<string | null>(null), [react, setReact] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null), [editBody, setEditBody] = useState("");
  const [hovered, setHovered] = useState<string | null>(null), [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [sourceHovered,setSourceHovered]=useState<string|null>(null),sourceHoverTimer=useRef(0);
  const [popoverBlock, setPopoverBlock] = useState<string | null>(null);
  const [textThread,setTextThread]=useState<{id:string;rectIndex:number}|null>(null);
  const [focusComposer,setFocusComposer]=useState<string|null>(null);
  const [focusVersion,setFocusVersion]=useState(0);
  const [ownReply, setOwnReply] = useState<{threadId:string;messageId:string}|null>(null);
  const indicatorButtons = useRef(new Map<string, HTMLButtonElement>());
  const [addTarget, setAddTarget] = useState<{ pos: number; left: number; top: number } | null>(null);
  const request = useRef(context.request), inflight = useRef(0), busyRef = useRef(false), alive = useRef(true);
  const reactionAnchor = useRef<HTMLElement | null>(null), layer = useRef<HTMLDivElement>(null);
  const moreAnchor = useRef<HTMLElement | null>(null);
  const cardKeys = useRef(new Map<string, string>()), addButton = useRef<HTMLButtonElement>(null);
  const addSurface=useRef<HTMLDivElement>(null);
  request.current = context.request;
  useEffect(()=>{if(data)onPeople?.(data.people);},[data,onPeople]);
  const reactionThread = data?.threads.find((item) => item.messages.some(message=>message.id===react)) ?? null;
  const popupThread = data?.threads.find(item=>item.messages.some(message=>message.id===more||message.id===react));
  const visualHover = popupThread?.id ?? hovered ?? sourceHovered ?? textThread?.id ?? data?.threads.find(item=>item.blockId===popoverBlock)?.id ?? null;
  const load = useCallback(async () => {
    const version = ++inflight.current;
    try { const next = await request.current<CommentData>(""); if (alive.current && version === inflight.current) { setData(next); setError(""); } }
    catch { if (alive.current) setError(t("loadFailed")); }
  }, [t]);
  useEffect(() => {
    alive.current = true; void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !busyRef.current) void load(); }, 20000);
    return () => { alive.current = false; window.clearInterval(timer); inflight.current++; };
  }, [load]);
  const mutate = async (command: CommentCommand): Promise<CommentData | null> => {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(true); setError(""); ++inflight.current;
    try {
      const next = await request.current<CommentData>("", { method: "POST", body: JSON.stringify(command) });
      if (!alive.current) return null;
      setData(next); setMore(null); if (command.action !== "createEmoji") setReact(null); return next;
    } catch { if (alive.current) setError(t("saveFailed")); return null; }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const close = () => {
    const value = readCommentDrafts(scope).find((d) => d.key === selected);
    if (value?.anchor && !hasCommentDraft(value.value)) { removeCommentDraft(scope,value.key); setDrafts(readCommentDrafts(scope).filter((d)=>d.anchor)); }
    onCloseDraft(); setSelected(null); setPopoverBlock(null); setTextThread(null); setFocusComposer(null); setList(false); setMore(null); setReact(null); setExpandedIds([]);
  };
  const open = (id: string, focus = true) => {
    onCloseDraft(); setSelected(id); setFocusComposer(focus?id:null); setList(false); setError("");
    if(focus)setFocusVersion(value=>value+1);
    setTextThread(current=>current?.id===id?current:null);
    if (selected !== id) { setMore(null); setReact(null); }
    const item = data?.threads.find((v) => v.id === id);
    if (item && (selected !== id || !focus)) setExpandedIds([id]);
    if (item?.unread) void mutate({ action: "unread", threadId: id, value: false });
  };
  useEffect(() => {
    if (!anchor) return;
    const key = newCommentDraftKey(anchor);
    if (!readCommentDrafts(scope).some((d) => d.key === key)) saveCommentDraft(scope, { key, anchor, value: emptyCommentDraft() });
    setDrafts(readCommentDrafts(scope).filter((d) => d.anchor)); setSelected(key); setFocusComposer(key); setFocusVersion(value=>value+1); setTextThread(null); setPopoverBlock(anchor.blockId); setHovered(null); setList(false);
  }, [anchor, scope]);
  const visibleThreads = useMemo(() => (data?.threads.filter((v) => !v.resolved || selected === v.id) ?? []).sort((a,b) => (a.messages[0]?.createdAt ?? '').localeCompare(b.messages[0]?.createdAt ?? '') || a.id.localeCompare(b.id)), [data,selected]);
  const pendingDrafts = editable ? drafts : [];
  const discardFirst=(key:string)=>{removeCommentDraft(scope,key);setDrafts(readCommentDrafts(scope).filter(item=>item.anchor));if(selected===key)close();};
  const cards = useMemo(() => [...visibleThreads.map((v) => ({ key: cardKeys.current.get(v.id) ?? v.id, blockId: v.blockId, anchorId: v.id })), ...(editable ? drafts : []).map((d) => ({ key: d.key, blockId: d.anchor!.blockId, anchorId: d.key, first: true }))], [visibleThreads, drafts, editable]);
  const elevated=sourceHovered??selected;
  const { placements, spaces, measure, compact, indicators } = useCommentLayout(editor, layer, cards, elevated ? cardKeys.current.get(elevated) ?? elevated : null);
  const selectedBlock = data?.threads.find(item=>item.id===selected)?.blockId ?? drafts.find(item=>item.key===selected)?.anchor?.blockId;
  const openBlock = compact ? popoverBlock ?? selectedBlock ?? null : null;
  const openRow=openBlock?commentRow(editor,openBlock):null;
  const inOpenRow=(blockId:string|undefined)=>Boolean(blockId&&openRow?.blockIds.includes(blockId));
  useEffect(()=>{if(!compact)setPopoverBlock(null);},[compact]);
  useEffect(()=>{
    if(data&&popoverBlock){const row=commentRow(editor,popoverBlock);if(!visibleThreads.some(item=>row.blockIds.includes(item.blockId))&&!pendingDrafts.some(item=>row.blockIds.includes(item.anchor?.blockId??'')))setPopoverBlock(null);}
  },[data,popoverBlock,visibleThreads,pendingDrafts]);
  useEffect(()=>{
    if(data&&textThread&&!visibleThreads.some(item=>item.id===textThread.id)){setTextThread(null);setSelected(null);setFocusComposer(null);setPopoverBlock(null);}
  },[data,textThread,visibleThreads]);
  useEffect(() => {
    setCommentAnchors(editor, { threads: data?.threads ?? [], active: selected, hovered:visualHover, draft: null, drafts: (editable ? drafts : []).map((d) => ({ ...d.anchor!, id: d.key })), spaces });
  }, [editor, data, selected, visualHover, drafts, spaces, editable]);
  useEffect(() => () => setCommentAnchors(editor, { threads: [], active: null, draft: null }), [editor]);
  useEffect(() => {
    if (!data) return;
    const hash = new URLSearchParams(window.location.hash.slice(1)), id = hash.get("comment");
    if (id && data.threads.some((v) => v.id === id)) {setSelected(id);setFocusComposer(id);}
    const blockId = hash.get("block"); if (blockId) editor.view.dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`)?.scrollIntoView({ block: "center" });
  }, [editor, Boolean(data)]);
  useEffect(() => {
    const inside = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".editor-overlay-shield,.editor-comment-card,.editor-comment-indicator,.editor-comment-block-popover,.editor-emoji-picker,.editor-mention-picker,.editor-comment-profile,.editor-comment-more,.editor-comment-reaction-preview,.relay-date-tooltip,.editor-comments-list,.editor-comments-toggle,.editor-add-comment"));
    const outside = (event: Event) => { if (!inside(event.target)) close(); };
    const escape = (event: KeyboardEvent) => {
      const fromText=event.target instanceof Node&&editor.view.dom.contains(event.target);
      if (event.key !== "Escape" || !inside(event.target)&&!(textThread&&fromText)) return;
      if (more || react) { setMore(null); setReact(null); }
      else { const trigger=openRow&&!textThread?indicatorButtons.current.get(openRow.blockId):null; close(); if(fromText)return; if(trigger)trigger.focus({preventScroll:true}); else if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }
    };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("focusin", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  });
  useEffect(()=>{
    const click=(event:MouseEvent)=>{
      const element=event.target instanceof Element?event.target.closest<HTMLElement>('[data-comment-anchor-id]'):null;
      const id=element?.dataset.commentAnchorId,blockId=element?.closest<HTMLElement>('[data-block-id]')?.dataset.blockId;
      const hit=editor.view.posAtCoords({left:event.clientX,top:event.clientY});
      const thread=data&&(blockId&&hit?commentThreadAt(editor,data.threads,blockId,hit.pos):null)||data?.threads.find(item=>item.id===id);
      if(!element||!thread)return;
      const rects=Array.from(editor.view.dom.querySelectorAll<HTMLElement>(`[data-comment-anchor-id="${CSS.escape(thread.id)}"]`)).flatMap(item=>Array.from(item.getClientRects()));
      const rectIndex=Math.max(0,rects.findIndex(rect=>event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom));
      open(thread.id,false);setPopoverBlock(thread.blockId);setTextThread({id:thread.id,rectIndex});
    };
    editor.view.dom.addEventListener('click',click);return()=>editor.view.dom.removeEventListener('click',click);
  });
  const canAddComment = editable && Boolean(onAddComment);
  useEffect(()=>{
    const move=(event:PointerEvent)=>{
      if(editorControlsBlocked(editor))return;
      const element=event.target instanceof Element?event.target:null;
      if(!element||!editor.view.dom.contains(element))return;
      const anchored=element.closest<HTMLElement>('[data-comment-anchor-id]');
      let id=anchored?.dataset.commentAnchorId;
      if(!id){for(let node=element.closest<HTMLElement>('[data-block-id]');node&&editor.view.dom.contains(node);node=node.parentElement?.closest<HTMLElement>('[data-block-id]')??null){const thread=visibleThreads.find(item=>item.blockId===node!.dataset.blockId);if(thread){id=thread.id;break;}}}
      window.clearTimeout(sourceHoverTimer.current);setSourceHovered(id??null);
    };
    const leave=(event:PointerEvent)=>{if(!(event.relatedTarget instanceof Element&&event.relatedTarget.closest('.editor-comment-card,.editor-comment-block-popover')))sourceHoverTimer.current=window.setTimeout(()=>setSourceHovered(null),180);};
    editor.view.dom.addEventListener('pointermove',move);editor.view.dom.addEventListener('pointerleave',leave);
    return()=>{editor.view.dom.removeEventListener('pointermove',move);editor.view.dom.removeEventListener('pointerleave',leave);};
  },[editor,visibleThreads]);
  useEffect(()=>()=>window.clearTimeout(sourceHoverTimer.current),[]);
  useEffect(() => {
    if (!canAddComment) return;
    setAddTarget(null);
    let point = { x: -1, y: -1 }, hide = 0;
    let active: {pos:number;left:number;top:number}|null=null;
    const clear = () => {active=null;setAddTarget(null);};
    const update = () => {
      if(editorControlsBlocked(editor)){setAddTarget(null);return;}
      const canvas = editorCanvas(editor).getBoundingClientRect(), clip = editorClipRect(editor);
      if (point.x < canvas.left || point.x > canvas.right || point.y < clip.top || point.y > clip.bottom) { setAddTarget(null); return; }
      const rect = editor.view.dom.getBoundingClientRect();
      const found = editor.view.posAtCoords({ left: Math.max(rect.left+1,Math.min(rect.right-1,point.x)), top: point.y });
      const target = found ? blockAt(editor,found.pos) : null, geometry = target ? blockGeometry(editor,target) : null;
      const blockId = target?.node.attrs.blockId;
      const targetDOM=target?editor.view.nodeDOM(target.pos):null;
      if(targetDOM instanceof HTMLElement&&targetDOM.closest('[data-type="columns"]')){clear();return;}
      const occupied = blockId && (data?.threads.some((item)=>item.blockId===blockId&&!item.resolved) || drafts.some((item)=>item.anchor?.blockId===blockId));
      if(!target||!geometry||occupied){setAddTarget(null);return;}
      // A column's controls belong to its own edge, not the page-wide edge.
      const left = Math.min(canvas.right - 32, geometry.rect.right + 20), top = geometry.top;
      if(editorControlZone(geometry.rect,point.x,point.y,geometry.left,left+28)!=='comment'){setAddTarget(null);return;}
      if (top < clip.top+2 || top+28 > clip.bottom-2) { setAddTarget(null); return; }
      const collision = Array.from(layer.current?.querySelectorAll<HTMLElement>('.editor-comment-card') ?? []).some((card)=>{const r=card.getBoundingClientRect();return left < r.right+4 && left+28 > r.left-4 && top < r.bottom+4 && top+28 > r.top-4;});
      if (collision) { setAddTarget(null); return; }
      active={pos:target.pos,left,top};setAddTarget(active);
    };
    const move = (event: PointerEvent) => {
      if (editorControlsBlocked(editor)||document.documentElement.classList.contains("editor-block-dragging")) { clear(); return; }
      if (event.target instanceof Node && addSurface.current?.contains(event.target)) { window.clearTimeout(hide); return; }
      const current=active?blockAt(editor,active.pos,true):null, geometry=current?blockGeometry(editor,current):null;
      if(active&&geometry&&editorControlBridge(event.clientX,event.clientY,geometry.rect.right,active.left+28,active.top)){window.clearTimeout(hide);return;}
      if(event.target instanceof Element&&event.target.closest('[data-column-resize],.editor-block-handles')){clear();return;}
      active=null;
      point={x:event.clientX,y:event.clientY}; window.clearTimeout(hide);
      if (event.target instanceof Element && event.target.closest(".editor-comment-card,.editor-comment-block-popover,.editor-comment-indicator,.editor-block-menu,.editor-comments-list,.editor-emoji-picker,.editor-mention-picker")) setAddTarget(null);
      else update();
    };
    document.addEventListener("pointermove",move); window.addEventListener("scroll",clear,true); window.addEventListener("resize",clear);
    return () => { window.clearTimeout(hide); document.removeEventListener("pointermove",move); window.removeEventListener("scroll",clear,true); window.removeEventListener("resize",clear); };
  }, [editor, canAddComment, data, drafts]);
  const send = async (key: string, value: CommentDraft, item?: CommentThread, first?: DraftAnchor) => {
    if (!data) return false;
    const next = await mutate(first ? { action: "create", ...first, ...value } : { action: "reply", threadId: item!.id, ...value });
    if (!next) return false;
    removeCommentDraft(scope,key);
    if (first) {
      const created = next.threads.find((v) => !data.threads.some((old) => old.id === v.id));
      if (created) cardKeys.current.set(created.id,key);
      setDrafts(readCommentDrafts(scope).filter((d) => d.anchor));
      close();
    } else if (item) { setExpandedIds((ids) => [...new Set([...ids,item.id])]); setSelected(item.id); const message=next.threads.find(thread=>thread.id===item.id)?.messages.at(-1); if(message)setOwnReply({threadId:item.id,messageId:message.id}); }
    return true;
  };
  const download = async (id: string) => {
    try {
      const file = await request.current<FileUpload>(`?fileId=${encodeURIComponent(id)}`), bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url),30000);
    } catch { setError(t("fileFailed")); }
  };
  const copyLink = async (item: CommentThread) => { try { await navigator.clipboard.writeText(context.blockLink(item.blockId,item.id)); setMore(null); } catch { setError(t("copyFailed")); } };
  const [pagePreview,setPagePreview] = useState<{ id:string; title:string; icon:string|null; excerpt:string }|null>(null);
  const hoverPage=useRef<string|null>(null),pagePreviewAnchor=useRef<HTMLElement|null>(null);
  const previewPage = async (id:string,element:HTMLElement) => {
    hoverPage.current=id;pagePreviewAnchor.current=element;
    try { const next=await request.current<{title:string;icon:string|null;excerpt:string}>(`?previewPage=${encodeURIComponent(id)}`);if(hoverPage.current===id)setPagePreview({id,...next}); } catch { /* Links remain usable offline. */ }
  };
  const relativeTime = (value: string) => commentTime(value, locale, t("justNow"));
  const reactionPeople = useMemo(() => [...new Map([...(data?.people??[]), ...(data?.threads.flatMap(v=>v.messages.map(m=>m.author))??[])].map(person=>[person.id,person])).values()], [data]);
  const renderBody = (message: CommentMessage) => {
    const references = [...message.mentions.map((p) => `@${p.name}`), ...message.pages.map((p) => `@${p.title}`), ...(message.dates ?? []).map((d) => `@${d}`)].sort((a,b) => b.length-a.length);
    const escaped = references.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const expression = new RegExp(`(${escaped.length ? escaped.join("|") + "|" : ""}https?:\\/\\/[^\\s]+)`, "g");
    return message.body.split(expression).map((part, i) => {
      const page = message.pages.find((p) => part === `@${p.title}`), person = message.mentions.find((p) => part === `@${p.name}`), date = (message.dates ?? []).find((d) => part === `@${d}`);
      if (page) return <button type="button" className="editor-inline-page" key={i} onClick={() => { context.openPage(page.id); }} onMouseEnter={(e) => void previewPage(page.id, e.currentTarget)} onMouseLeave={() => { hoverPage.current = null; setPagePreview(null); }}>{page.icon || "↗"} {page.title || t("untitled")}</button>;
      if (person) return <span className="editor-inline-mention" key={i}>{part}</span>;
      if (date) return <time className="editor-inline-date" key={i} dateTime={date}>◷ {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date))}</time>;
      return /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part;
    });
  };
  const renderThread = (thread: CommentThread, grouped = false) => {
    const node = editor.view.dom.querySelector(`[data-block-id="${CSS.escape(thread.blockId)}"]`);
    const expanded = grouped || expandedIds.includes(thread.id);
    return <>
      {!node ? <p className="editor-comment-status">{t("missingBlock")}</p> : null}
          {thread.messages.filter((_, index) => index === 0 || expanded).map((message, index) => <Fragment key={message.id}><article className="editor-comment-message" tabIndex={0} data-reply={index > 0} style={{'--comment-toolbar-width':`${editable ? (index===0?78:55) : 32}px`} as React.CSSProperties}>
            <div className="editor-comment-author"><CommentAvatar person={message.author} me={data!.me.id} /><strong title={message.author.name}>{message.author.name}</strong><DateLabel value={message.createdAt}>{relativeTime(message.createdAt)}</DateLabel></div>
            <div className="editor-comment-toolbar" data-open={more === message.id || react === message.id}>
              {editable ? <button type="button" onClick={(event) => { reactionAnchor.current = event.currentTarget; setReact(react === message.id ? null : message.id); setMore(null); }} aria-label={t("reaction")}><BlockGlyph type="react" /></button> : null}
              {editable && thread.messages[0].id === message.id ? <button type="button" disabled={busy} onClick={() => void mutate({ action: "resolve", threadId: thread.id, value: !thread.resolved }).then((next) => { if (next && !thread.resolved) { setSelected(null); } })} aria-label={t(thread.resolved ? "reopen" : "resolve")}><BlockGlyph type="resolve" /></button> : null}
              <button type="button" onClick={(event) => { moreAnchor.current=event.currentTarget; setMore(more === message.id ? null : message.id); setReact(null); }} aria-label={t("more")} aria-haspopup="menu" aria-expanded={more === message.id}><BlockGlyph type="more" /></button>
            </div>

            {grouped && index===0 && thread.quote ? <blockquote className="editor-comment-quote">{thread.quote}</blockquote>:null}
            {editing === message.id ? <div className="editor-comment-edit"><textarea autoFocus aria-label={t("edit")} value={editBody} onChange={(e) => setEditBody(e.target.value)} /><button type="button" disabled={busy || !editBody.trim()} onClick={() => void mutate({ action: "edit", threadId: thread.id, messageId: message.id, body: editBody }).then((next) => { if (next) setEditing(null); })}>{t("save")}</button><button type="button" onClick={() => setEditing(null)}>{t("cancel")}</button></div> : <div className="editor-comment-body">{renderBody(message)}{message.editedAt ? <small> {t("edited")}</small> : null}</div>}
            {message.mentions.filter((person) => !message.body.includes(`@${person.name}`)).map((person) => <span className="editor-comment-mention" key={person.id}>@{person.name}</span>)}
            {message.pages.filter((page) => !message.body.includes(`@${page.title}`)).map((page) => <button type="button" className="editor-comment-page" key={page.id} onClick={() => { context.openPage(page.id); }} onMouseEnter={(e) => void previewPage(page.id, e.currentTarget)} onMouseLeave={() => { hoverPage.current = null; setPagePreview(null); }} title={page.title}><span>{page.icon || "↗"}</span>{page.title || t("untitled")}</button>)}
            {message.files.map((file) => <button type="button" className="editor-comment-file" key={file.id} onClick={() => void download(file.id)}><BlockGlyph type="attach" /><span>{file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small></button>)}
            {message.reactions.length ? <div className="editor-comment-reactions">{message.reactions.map((r) => <CommentReaction key={r.emoji} emoji={r.emoji} userIds={r.userIds} people={reactionPeople} custom={data!.customEmojis??[]} active={r.userIds.includes(data!.me.id)} disabled={busy||!editable} onToggle={()=>void mutate({action:'react',threadId:thread.id,messageId:message.id,emoji:r.emoji})}/>)}{editable ? <button type="button" className="editor-comment-add-reaction" aria-label={t("reaction")} onClick={(event) => { reactionAnchor.current = event.currentTarget; setReact(react === message.id ? null : message.id); setMore(null); }}><BlockGlyph type="react" /></button> : null}</div> : null}
          </article>{!grouped && index === 0 && thread.messages.length > 1 ? <button type="button" className="editor-comment-reply-toggle" aria-expanded={expanded} onClick={() => { open(thread.id); setExpandedIds((ids) => expanded ? ids.filter((id) => id !== thread.id) : [...new Set([...ids,thread.id])]); }}>{expanded ? t("hideReplies") : t("showReplies", { count: thread.messages.length - 1 })}</button> : null}</Fragment>)}
    </>;
  };
  const card = (key: string, activeId: string, first: boolean, content: React.ReactNode, composer?: React.ReactNode) => {
    const placement=placements.find((p)=>p.key===key);
    const latest=data?.threads.find(item=>item.id===activeId)?.messages.at(-1);
    return <CommentCard key={key} id={key} first={first} active={selected===activeId} expanded={expandedIds.includes(activeId)} latest={latest?.id} latestFromMe={latest?.author.id===data?.me.id} hovered={visualHover===activeId} left={placement?.left??0} top={placement?.top??0} width={placement?.width??328} ready={Boolean(placement)} onActivate={()=>open(activeId)} onHover={(value)=>{window.clearTimeout(sourceHoverTimer.current);setHovered(value?activeId:null);if(!value||sourceHovered&&sourceHovered!==activeId)setSourceHovered(null);}} onMeasure={measure} composer={composer}>{content}</CommentCard>;
  };
  const menuThread=data?.threads.find(item=>item.messages.some(message=>message.id===more));
  const menuMessage=menuThread?.messages.find(message=>message.id===more);
  return <>
    <CommentActionTooltip/>
    <OverlayPresence visible={Boolean(menuThread&&menuMessage&&moreAnchor.current)}>{menuThread&&menuMessage&&moreAnchor.current ? <CommentMessageMenu anchor={moreAnchor.current} label={t('more')} onClose={()=>setMore(null)} items={[
      {label:t('markUnread'),icon:'markUnread',disabled:busy,run:()=>void mutate({action:'unread',threadId:menuThread.id,value:true}).then(next=>{if(next)close();})},
      ...(editable&&menuMessage.author.id===data!.me.id?[{label:t('edit'),icon:'edit',disabled:busy,run:()=>{setEditing(menuMessage.id);setEditBody(menuMessage.body);}}]:[]),
      {label:t('copyLink'),icon:'copyLink',run:()=>void copyLink(menuThread)},
      {label:t(menuThread.muted?'unmute':'mute'),icon:'mute',disabled:busy,separator:true,run:()=>void mutate({action:'mute',threadId:menuThread.id,value:!menuThread.muted})},
      ...(editable&&menuMessage.author.id===data!.me.id?[{label:t('delete'),icon:'delete',danger:true,disabled:busy,run:()=>void mutate({action:'deleteMessage',threadId:menuThread.id,messageId:menuMessage.id}).then(next=>{if(next&&!next.threads.some(item=>item.id===menuThread.id))setSelected(null);})}]:[])
    ]}/>:null}</OverlayPresence>
    <button type="button" className="editor-comments-toggle" onClick={()=>{onCloseDraft();setSelected(null);setPopoverBlock(null);setTextThread(null);setFocusComposer(null);setList((v)=>!v);}} aria-label={t("title")}><BlockGlyph type="comment"/>{t("title")}{visibleThreads.length ? <span>{visibleThreads.length}</span>:null}{visibleThreads.some((v)=>v.unread&&!v.muted)?<i aria-label={t("unread")}/>:null}</button>
    {error && !selected ? <div role="alert" className="editor-comment-error">{error}{!data?<button type="button" onClick={()=>void load()}>{t("retry")}</button>:null}</div>:null}
    <EditorAnnotations editor={editor} canvasRef={layer}>
      {compact ? indicators.map(indicator=>{
        const count=visibleThreads.filter(item=>indicator.blockIds.includes(item.blockId)).reduce((sum,item)=>sum+item.messages.length,0);
        return <button key={indicator.blockId} ref={element=>{if(element)indicatorButtons.current.set(indicator.blockId,element);else indicatorButtons.current.delete(indicator.blockId);}} type="button" className="editor-comment-indicator" style={{left:indicator.left,top:indicator.top}} data-block-id={indicator.blockId} aria-label={`${t('title')} · ${count}`} aria-haspopup="dialog" aria-expanded={openRow?.blockId===indicator.blockId} onClick={()=>{if(openRow?.blockId===indicator.blockId&&!textThread)close();else{const last=pendingDrafts.filter(item=>indicator.blockIds.includes(item.anchor?.blockId??'')).at(-1)?.key??visibleThreads.filter(item=>indicator.blockIds.includes(item.blockId)).at(-1)?.id;setMore(null);setReact(null);setTextThread(null);if(last)open(last,editable);setList(false);setPopoverBlock(indicator.blockId);}}}><BlockGlyph type="comment"/>{count?<span>{count>9?'9+':count}</span>:null}</button>;
      }) : visibleThreads.map((item)=>card(cardKeys.current.get(item.id)??item.id,item.id,false,<>
        {renderThread(item)}
        {error && selected===item.id ? <div role="alert" className="editor-comment-error">{error}</div>:null}
      </>, editable && data ? <CommentComposer focusVersion={focusVersion} scope={scope} draftKey={item.id} data={data} active={selected===item.id} autoFocus={focusComposer===item.id&&placements.some(p=>p.key===(cardKeys.current.get(item.id)??item.id))} first={false} busy={busy} onActivate={()=>open(item.id)} onError={setError} onSend={(value)=>send(item.id,value,item)}/>:null))}
      {!compact && pendingDrafts.map((item)=>card(item.key,item.key,true,<>
        {error && selected===item.key ? <div role="alert" className="editor-comment-error">{error}</div>:null}
        {data ? <CommentComposer focusVersion={focusVersion} scope={scope} draftKey={item.key} anchor={item.anchor} data={data} active={selected===item.key} autoFocus={focusComposer===item.key&&placements.some(p=>p.key===item.key)} onDiscard={()=>discardFirst(item.key)} first busy={busy} onActivate={()=>open(item.key)} onError={setError} onSend={(value)=>send(item.key,value,undefined,item.anchor)}/>:<p className="editor-comment-status">{t("loading")}</p>}
      </>))}
    </EditorAnnotations>
    <OverlayPresence visible={Boolean(openBlock&&data)}>{openBlock && data ? <CommentBlockPopover editor={editor} blockId={openBlock} label={t('title')} ownReply={ownReply} textThread={textThread} focusComposer={focusComposer}>
      {visibleThreads.filter(item=>inOpenRow(item.blockId)&&(!textThread||item.id===textThread.id)).map(item=><section key={item.id} className="editor-comment-popover-thread" data-thread-id={item.id} data-hovered={visualHover===item.id} onMouseEnter={()=>setHovered(item.id)} onMouseLeave={()=>setHovered(null)}>
        {renderThread(item,true)}
        {editable?<CommentComposer focusVersion={focusVersion} scope={scope} draftKey={item.id} data={data} active={selected===item.id} autoFocus={focusComposer===item.id} first={false} persistent busy={busy} onActivate={()=>open(item.id)} onError={setError} onSend={value=>send(item.id,value,item)}/>:null}
        {error && selected===item.id?<div role="alert" className="editor-comment-error">{error}</div>:null}
      </section>)}
      {pendingDrafts.filter(item=>!textThread&&inOpenRow(item.anchor?.blockId)).map(item=><section key={item.key} className="editor-comment-popover-thread">
        {item.anchor?.quote?<blockquote className="editor-comment-quote">{item.anchor.quote}</blockquote>:null}
        <CommentComposer focusVersion={focusVersion} scope={scope} draftKey={item.key} anchor={item.anchor} data={data} active={selected===item.key} onDiscard={()=>discardFirst(item.key)} first persistent busy={busy} onActivate={()=>open(item.key)} onError={setError} onSend={value=>send(item.key,value,undefined,item.anchor)}/>
        {error&&selected===item.key?<div role="alert" className="editor-comment-error">{error}</div>:null}
      </section>)}
    </CommentBlockPopover>:null}</OverlayPresence>
    <OverlayPresence visible={Boolean(controlsVisible&&addTarget&&onAddComment)} exitDuration={260}>{controlsVisible && addTarget && onAddComment ? createPortal(<OverlaySurface surfaceRef={addSurface} motionKind="controls" className="editor-add-comment-control" style={{left:addTarget.left,top:addTarget.top}}><button ref={addButton} type="button" className="editor-add-comment" aria-label={t("add")} onPointerDown={(e)=>e.preventDefault()} onClick={()=>onAddComment(blockAt(editor,addTarget.pos,true))}><BlockGlyph type="addComment"/><span role="tooltip">{t("add")}</span></button></OverlaySurface>,document.body):null}</OverlayPresence>
    {list ? createPortal(<aside className="editor-comments-list" aria-label={t("title")}><header><strong>{t("title")}</strong><button type="button" onClick={close} aria-label={t("close")}><BlockGlyph type="close"/></button></header><OverlayScroll className="editor-comment-list-scroll">
      <label className="editor-comment-resolved"><input type="checkbox" checked={showResolved} onChange={(e)=>setShowResolved(e.target.checked)}/>{t("showResolved")}</label>
      {data?.threads.filter((v)=>showResolved||!v.resolved).map((item)=><button type="button" key={item.id} className="editor-comment-thread-row" onClick={()=>open(item.id)}><span>{item.quote||t("block")}</span><small>{item.messages.at(-1)?.body||t("attachment")} · {item.messages.length}</small>{item.resolved?<BlockGlyph type="resolve"/>:item.unread&&!item.muted?<i/>:null}</button>)}
      {!data?.threads.some((v)=>showResolved||!v.resolved)?<p className="editor-comment-status">{t("empty")}</p>:null}
    </OverlayScroll></aside>,document.body):null}
    <OverlayPresence visible={Boolean(react&&reactionAnchor.current&&reactionThread)}>{react && reactionAnchor.current && reactionThread ? <EmojiPicker anchor={reactionAnchor.current} custom={data?.customEmojis??[]} identity={context.identity} busy={busy} onClose={()=>setReact(null)} onPick={(emoji)=>void mutate({action:"react",threadId:reactionThread.id,messageId:react,emoji})} onUpload={async(name,image)=>{const messageId=react;const next=await mutate({action:"createEmoji",name,data:image,type:"image/png"});if(next)setReact(messageId);return Boolean(next);}}/>:null}</OverlayPresence>
    {pagePreview && pagePreviewAnchor.current ? createPortal(<aside className="editor-comment-page-preview" style={{left:Math.max(12,Math.min(pagePreviewAnchor.current.getBoundingClientRect().left,window.innerWidth-Math.min(290,window.innerWidth-24)-12)),top:Math.max(12,Math.min(pagePreviewAnchor.current.getBoundingClientRect().bottom+8,window.innerHeight-232))}}><strong>{pagePreview.icon} {pagePreview.title||t("untitled")}</strong><p>{pagePreview.excerpt}</p></aside>,document.body):null}
  </>;
}
