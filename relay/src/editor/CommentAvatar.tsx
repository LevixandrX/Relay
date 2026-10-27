"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "use-intl";
import type { CommentPerson } from "./comment-types";
import {OverlayPresence,OverlaySurface} from './EditorOverlay';

export function CommentAvatar({ person, me, className = '' }: { person: CommentPerson; me: string; className?:string }) {
  const t = useTranslations("editorTools.comments"), locale = useLocale(), id = useId();
  const ref = useRef<HTMLButtonElement>(null), timer = useRef(0), [open, setOpen] = useState(false);
  const popup=useRef<HTMLDivElement>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[person.avatarUrl]);
  const cancel = () => window.clearTimeout(timer.current);
  const enter = () => { cancel(); timer.current = window.setTimeout(() => setOpen(true), 220); };
  const leave = () => { cancel(); timer.current = window.setTimeout(() => setOpen(false), 120); };
  useEffect(() => {
    const close = () => setOpen(false);
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true); window.addEventListener("keydown", escape);
    return () => { cancel(); window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", escape); };
  }, []);
  const image = person.avatarUrl && !failed ? <img src={person.avatarUrl} alt="" draggable={false} onError={()=>setFailed(true)}/> : <span className="editor-comment-avatar" aria-hidden>{person.name.slice(0, 1)}</span>;
  const rect = ref.current?.getBoundingClientRect(), width = Math.min(304, window.innerWidth - 24);
  const left = rect ? Math.max(12, Math.min(rect.left - width - 10, window.innerWidth - width - 12)) : 12;
  const top = rect ? Math.max(12, Math.min(rect.top - 18, window.innerHeight - 116)) : 12;
  return <>
    <button ref={ref} type="button" className={`editor-comment-author-avatar ${className}`} aria-label={t("profile", { name: person.name })} aria-describedby={open ? id : undefined}
      onPointerEnter={enter} onPointerLeave={leave} onFocus={() => { cancel(); setOpen(true); }} onBlur={leave} onClick={() => setOpen(true)}>{image}</button>
    <OverlayPresence visible={open}>{open ? createPortal(<OverlaySurface surfaceRef={popup} id={id} role="tooltip" className="editor-comment-profile" style={{ left, top, width }} onPointerEnter={cancel} onPointerLeave={leave}>
      <div className="editor-comment-profile-avatar">{image}</div>
      <div><strong>{person.name}{person.id === me ? ` (${t("you")})` : ""}</strong>
        <span>{t(`roles.${person.role ?? (person.id === "guest" ? "guest" : "member")}`)}</span>
        {person.id === me ? <small>{t("localTime", { time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date()) })}</small> : null}
      </div>
    </OverlaySurface>, document.body) : null}</OverlayPresence>
  </>;
}
