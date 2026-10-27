"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "use-intl";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import type { CommentData } from "./comment-types";
import {OverlaySurface} from './EditorOverlay';
export type MentionEntry = { kind: "people" | "pages" | "dates"; id: string; label: string; icon: string; detail?: string };
export function mentionEntries(data: CommentData, query: string, locale: string) {
  const ru = locale.startsWith("ru"), fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const dates: MentionEntry[] = [-1, 0, 1].map((offset) => { const date = new Date(); date.setDate(date.getDate() + offset); const id = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; return { kind: "dates", id, icon: "◷", label: offset === -1 ? ru ? "Вчера" : "Yesterday" : offset === 0 ? ru ? "Сегодня" : "Today" : ru ? "Завтра" : "Tomorrow", detail: fmt.format(date) }; });
  if (/^\d{4}-\d{2}-\d{2}$/.test(query) && !Number.isNaN(Date.parse(query)) && new Date(query).toISOString().slice(0,10) === query) dates.unshift({ kind: "dates", id: query, icon: "◷", label: query });
  const all: MentionEntry[] = [...dates, ...data.people.map((p) => ({ kind: "people" as const, id: p.id, label: p.name, icon: "@" })), ...data.pages.map((p) => ({ kind: "pages" as const, id: p.id, label: p.title || (ru ? "Без названия" : "Untitled"), icon: p.icon || "↗" }))];
  const q = query.trim().toLocaleLowerCase(); return all.filter((e) => `${e.label} ${e.detail ?? ""} ${e.id}`.toLocaleLowerCase().includes(q)).slice(0, 60);
}
export function MentionPicker({ anchor, entries, active, id, onPick, onHover,onClose }: { anchor: HTMLElement; entries: MentionEntry[]; active: number; id: string; onPick: (entry: MentionEntry) => void; onHover: (index: number) => void; onClose:()=>void }) {
  const t = useTranslations("editorTools.mentions"), locale = useLocale();
  const root = useRef<HTMLDivElement>(null), [position, setPosition] = useState({ left: 12, top: 12 });
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target)&&!anchor.contains(event.target))onClose();};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[anchor,onClose]);
  useLayoutEffect(() => { const place = () => { const r = anchor.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24), h = root.current?.offsetHeight ?? 260; setPosition({ left: Math.max(12, Math.min(r.left, window.innerWidth - w - 12)), top: Math.max(12, Math.min(r.top - h - 8, window.innerHeight - h - 12)) }); }; place(); const observer = new ResizeObserver(place); if (root.current) observer.observe(root.current); window.addEventListener("resize", place); return () => { observer.disconnect(); window.removeEventListener("resize", place); }; }, [anchor]);
  useLayoutEffect(() => { const row = root.current?.querySelector<HTMLElement>(`[data-index="${active}"]`), port = row?.closest<HTMLElement>(".overlay-scroll-target"); if (row && port) { const r = row.getBoundingClientRect(), p = port.getBoundingClientRect(); if (r.top < p.top) port.scrollTop += r.top - p.top; else if (r.bottom > p.bottom) port.scrollTop += r.bottom - p.bottom; } }, [active]);
  return createPortal(<OverlaySurface surfaceRef={root} blockLevel={116} className="editor-mention-picker" style={position}><OverlayScroll><div id={id} role="listbox" aria-label={t("title")}>{entries.map((entry,index) => <div className={index > 0 && entries[index-1].kind !== entry.kind ? "editor-mention-section-start" : undefined} key={`${entry.kind}-${entry.id}`}>{index === 0 || entries[index-1].kind !== entry.kind ? <h4>{t(entry.kind)}</h4> : null}<button id={`${id}-${index}`} type="button" role="option" aria-selected={index === active} data-index={index} onPointerDown={(e) => e.preventDefault()} onMouseEnter={() => onHover(index)} onClick={() => onPick(entry)}><span>{entry.icon}</span><span>{entry.label}{entry.detail ? <small>{entry.detail}</small> : null}</span></button></div>)}{!entries.length ? <p>{t("empty")}</p> : null}</div></OverlayScroll><label className="editor-mention-date">{t("date")}<input aria-label={t("date")} type="date" lang={locale} onChange={(e) => { if (e.target.value) onPick({ kind: "dates", id: e.target.value, label: e.target.value, icon: "◷" }); }} /></label></OverlaySurface>, document.body);
}
