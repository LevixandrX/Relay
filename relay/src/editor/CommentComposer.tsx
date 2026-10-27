"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { BlockGlyph } from "./block-preview";
import { MentionPicker, mentionEntries, type MentionEntry } from "./MentionPicker";
import { emptyCommentDraft, hasCommentDraft, readCommentDrafts, removeCommentDraft, saveCommentDraft, stageCommentDraft, type SavedCommentDraft } from "./comment-drafts";
import {focusCommentInput} from './comment-composer-focus';
import {measureCommentInput} from './composer-layout';
import {OverlayPresence} from './EditorOverlay';
import type { CommentData, CommentDraft, DraftAnchor, FileUpload } from "./comment-types";

export function CommentComposer({ scope, draftKey, anchor, data, active, first, busy, persistent = false, autoFocus = true, focusVersion = 0, onDiscard, onActivate, onSend, onError }: {
  scope: string; draftKey: string; anchor?: DraftAnchor; data: CommentData; active: boolean; first: boolean; busy: boolean;
  persistent?: boolean;
  autoFocus?: boolean;
  focusVersion?: number; onDiscard?:()=>void;
  onActivate: () => void; onSend: (draft: CommentDraft) => Promise<boolean>; onError: (error: string) => void;
}) {
  const t = useTranslations("editorTools.comments"), locale = useLocale(), mentionId = useId();
  const [draft, setDraft] = useState(() => readCommentDrafts(scope).find((d) => d.key === draftKey)?.value ?? emptyCommentDraft());
  const [attaching, setAttaching] = useState(false), [picker, setPicker] = useState(false), [filter, setFilter] = useState("");
  const [mentionActive, setMentionActive] = useState(0), [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null), upload = useRef<HTMLInputElement>(null);
  const latest = useRef(draft), sending = useRef(false), modified = useRef(false),generation=useRef(0);
  const selection=useRef<SavedCommentDraft['selection']>(readCommentDrafts(scope).find(item=>item.key===draftKey)?.selection);
  const [multiline,setMultiline]=useState(false);
  const measureInput=useRef<()=>void>(()=>{});
  latest.current = draft;
  const persist = (value: CommentDraft) => {
    if (sending.current) return;
    if (hasCommentDraft(value) || readCommentDrafts(scope).some((d) => d.key === draftKey) || !anchor && modified.current) saveCommentDraft(scope, { key: draftKey, anchor, value, selection:selection.current });
  };
  const change = (fn: (value: CommentDraft) => CommentDraft) => {
    const next = fn(latest.current); modified.current = true; latest.current = next; setDraft(next);
    stageCommentDraft(scope, { key: draftKey, anchor, value: next, selection:selection.current });
  };
  const rememberSelection=()=>{
    const field=input.current;if(!field)return;
    selection.current={start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection};
    if(hasCommentDraft(latest.current))stageCommentDraft(scope,{key:draftKey,anchor,value:latest.current,selection:selection.current});
    measureInput.current();
  };
  useEffect(() => { const timer = window.setTimeout(() => persist(latest.current), 180); return () => window.clearTimeout(timer); }, [draft]);
  useEffect(() => () => { generation.current++; if (!sending.current) persist(latest.current); }, [scope, draftKey]);
  useEffect(() => {
    const wanted=active&&autoFocus;
    let frame=0;
    if (wanted) frame=requestAnimationFrame(() => {
      const focused = document.activeElement;
      if (focused instanceof Element && focused.closest("button,a,input") && input.current?.closest(".editor-comment-card,.editor-comment-popover-thread")?.contains(focused)) return;
      if(input.current&&getComputedStyle(input.current).visibility!=='hidden')focusCommentInput(input.current);
    });
    if (!active) setPicker(false);
    return()=>cancelAnimationFrame(frame);
  }, [active, autoFocus, focusVersion]);
  useLayoutEffect(()=>{
    const field=input.current,box=field?.parentElement;if(!field||!box)return;
    const helper=document.createElement('div');helper.setAttribute('aria-hidden','true');document.body.append(helper);
    let lastWidth=-1,frame=0;
    const measure=()=>{
      const result=measureCommentInput(field,helper),style=getComputedStyle(field),tools=box.querySelector<HTMLElement>('.editor-comment-composer-tools');
      let stacked=result.height>result.singleHeight+1;
      if(!stacked){const canvas=document.createElement('canvas').getContext('2d');if(canvas){canvas.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;stacked=canvas.measureText(field.value).width>field.clientWidth-(tools?.offsetWidth??0)-20;}}
      setMultiline(stacked);
      const inPopover=Boolean(field.closest('.editor-comment-block-popover'));
      const limit=inPopover?result.height:Math.max(60,Math.min(200,innerHeight-200));
      field.style.height=`${Math.min(limit,result.height)}px`;
      field.style.overflowY=inPopover||result.height<=limit?'hidden':'auto';
      field.dispatchEvent(new Event('relay:comment-resize',{bubbles:true}));
      if(document.activeElement===field){
        const top=Number(field.dataset.caretTop)||8,bottom=top+result.line;
        if(bottom>field.scrollTop+field.clientHeight-8)field.scrollTop=bottom-field.clientHeight+8;
        else if(top<field.scrollTop+8)field.scrollTop=Math.max(0,top-8);
        cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>field.dispatchEvent(new CustomEvent('relay:comment-caret',{bubbles:true})));
      }
    };
    measureInput.current=measure;measure();
    const observer=new ResizeObserver(()=>{if(lastWidth!==field.clientWidth){lastWidth=field.clientWidth;measure();}});observer.observe(field);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();helper.remove();measureInput.current=()=>{};};
  },[]);
  useLayoutEffect(()=>measureInput.current(),[draft.body,active,multiline]);
  const discard=()=>{
    generation.current++;latest.current=emptyCommentDraft();selection.current={start:0,end:0,direction:'none'};modified.current=false;
    removeCommentDraft(scope,draftKey);setDraft(latest.current);setPicker(false);setRange(null);setAttaching(false);if(upload.current)upload.current.value='';
    if(onDiscard)onDiscard();else input.current?.focus({preventScroll:true});
  };
  const entries = mentionEntries(data, filter, locale);
  const checkMention = (body: string, caret: number) => {
    const match = body.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
    setPicker(Boolean(match)); setRange(match ? { from: caret - match[1].length - 1, to: caret } : null);
    if (match) { setFilter(match[1]); setMentionActive(0); }
  };
  const choose = (entry: MentionEntry) => {
    const at = range ?? { from: input.current?.selectionStart ?? draft.body.length, to: input.current?.selectionEnd ?? draft.body.length };
    const token = `@${entry.kind === "dates" ? entry.id : entry.label} `;
    change((old) => ({ ...old, body: old.body.slice(0, at.from) + token + old.body.slice(at.to), [entry.kind === "people" ? "mentions" : entry.kind]: [...new Set([...(old[entry.kind === "people" ? "mentions" : entry.kind] ?? []), entry.id])] }));
    setPicker(false); setRange(null); setFilter("");
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(at.from + token.length, at.from + token.length); });
  };
  const mention = () => {
    if (picker) { setPicker(false); input.current?.focus(); return; }
    const start = input.current?.selectionStart ?? draft.body.length, end = input.current?.selectionEnd ?? start;
    const token = start && !/\s/.test(draft.body[start - 1]) ? " @" : "@";
    const body = draft.body.slice(0, start) + token + draft.body.slice(end);
    change((old) => ({ ...old, body })); checkMention(body, start + token.length);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + token.length, start + token.length); });
  };
  const send = async () => {
    if (sending.current || attaching || busy || (!draft.body.trim() && !draft.files.length && !draft.pages.length)) return;
    persist(latest.current); sending.current = true;
    if (await onSend(latest.current)) {
      // Persist the empty state before unmounting the first-comment composer.
      latest.current = emptyCommentDraft(); selection.current={start:0,end:0,direction:'none'}; setDraft(latest.current); setPicker(false);
    } else { sending.current = false; persist(latest.current); }
    sending.current = false;
  };
  const attach = async (files: FileList | null) => {
    if (!files || attaching) return;
    if (files.length + draft.files.length > 3 || [...files].some((f) => f.size > 2 * 1024 * 1024)) { onError(t("fileLimit")); return; }
    const version=generation.current;setAttaching(true);
    try {
      const added = await Promise.all([...files].map(async (file): Promise<FileUpload> => ({ name: file.name, type: file.type || "application/octet-stream", size: file.size, data: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.readAsDataURL(file); }) })));
      if(version!==generation.current)return;
      change((old) => ({ ...old, files: [...old.files, ...added] })); persist(latest.current);
    } catch { if(version===generation.current)onError(t("fileFailed")); }
    finally { if(version===generation.current)setAttaching(false); }
  };
  const canDiscard=hasCommentDraft(draft);
  return <div className="editor-comment-composer" data-composer-key={draftKey} data-draft-scope={scope} data-first={first} data-persistent={persistent} data-active={active} hidden={!persistent && !first && !active}>
    <OverlayPresence visible={Boolean(picker&&active&&input.current)}>{picker && active && input.current ? <MentionPicker anchor={input.current} entries={entries} active={mentionActive} id={mentionId} onPick={choose} onHover={setMentionActive} onClose={()=>setPicker(false)} /> : null}</OverlayPresence>
    <div className="editor-comment-compose-row">
      {!first || persistent ? data.me.avatarUrl ? <img className="editor-comment-compose-avatar" src={data.me.avatarUrl} alt="" /> : <span className="editor-comment-avatar editor-comment-compose-avatar" aria-hidden>{data.me.name.slice(0, 1)}</span> : null}
      <div className="editor-comment-compose-field" data-multiline={multiline} data-cancel-open={canDiscard}>
        <textarea ref={input} rows={1} onFocus={onActivate} onSelect={rememberSelection} onBlur={() => {rememberSelection();persist(latest.current);}} aria-label={t("placeholder")} placeholder={t("placeholder")} maxLength={10000} value={draft.body} aria-expanded={picker} aria-controls={picker ? mentionId : undefined} aria-activedescendant={picker && entries.length ? `${mentionId}-${mentionActive}` : undefined}
          onChange={(e) => {
            const body = e.target.value;
            selection.current={start:e.target.selectionStart,end:e.target.selectionEnd,direction:e.target.selectionDirection};
            change((v) => ({ ...v, body, mentions: v.mentions.filter((id) => data.people.some((p) => p.id === id && body.includes(`@${p.name}`))), pages: v.pages.filter((id) => data.pages.some((p) => p.id === id && body.includes(`@${p.title}`))), dates: v.dates?.filter((date) => body.includes(`@${date}`)) }));
            checkMention(body, e.target.selectionStart);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (picker && !e.shiftKey && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
              e.preventDefault(); e.stopPropagation();
              if (e.key === "Escape") setPicker(false);
              else if (e.key === "Enter") { if (entries[mentionActive]) choose(entries[mentionActive]); }
              else setMentionActive((v) => entries.length ? (v + (e.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length : 0);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            if (e.key === "Escape") persist(latest.current);
          }} />
        <div className="editor-comment-composer-tools">
          <button type="button" disabled={attaching} onClick={() => upload.current?.click()} aria-label={t("attach")}><BlockGlyph type="attach" /></button>
          <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={mention} aria-label={t("mention")}><BlockGlyph type="mention" /></button>
          <button type="button" className="editor-comment-send" disabled={busy || attaching || (!draft.body.trim() && !draft.files.length && !draft.pages.length)} onClick={() => void send()} aria-label={t("send")}><BlockGlyph type="up" /></button>
        </div>
        {draft.files.length?<div className="editor-comment-compose-files">{draft.files.map((file, index) => <button type="button" className="editor-comment-chip" key={index} onClick={() => change((v) => ({ ...v, files: v.files.filter((_, i) => i !== index) }))} aria-label={t("removeAttachment", { name: file.name })}>{file.name} ×</button>)}</div>:null}
        <div className="editor-comment-cancel-shelf" data-open={canDiscard} aria-hidden={!canDiscard}><div><button type="button" disabled={busy||!canDiscard} tabIndex={canDiscard?0:-1} onClick={discard}>{t('cancel')}</button></div></div>
      </div>
    </div>
    <input ref={upload} type="file" multiple hidden onChange={(e) => { void attach(e.target.files); e.target.value = ""; }} />
  </div>;
}
