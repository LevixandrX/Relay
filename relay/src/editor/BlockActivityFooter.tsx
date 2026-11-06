"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {useLocale,useTranslations} from 'use-intl';
import {DateLabel} from '../components/DateLabel';
import {activityTime} from '../lib/display-time';
import type {BlockActivityInfo} from '../lib/block-activity';
import type {CommentPerson} from './comment-types';
import {CommentAvatar} from './CommentAvatar';
import {RichPopover} from './RichPopover';
export function BlockActivityFooter({info,people=[],owner:parent}:{info:BlockActivityInfo|null;people?:CommentPerson[];owner?:string}){
  const t=useTranslations('editorTools.activity'),locale=useLocale(),id=useId(),owner=parent??id,trigger=useRef<HTMLButtonElement>(null),timer=useRef(0),[open,setOpen]=useState(false);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const person=(name:string):CommentPerson=>people.find(p=>p.name===name)??{id:name,name};
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  if(!info)return null;
  return <div className="editor-menu-activity"><span>{t('lastEdited')}</span>{info?<><button ref={trigger} type="button" className="editor-menu-editor editor-activity-trigger" onPointerEnter={()=>{clearTimeout(timer.current);timer.current=window.setTimeout(()=>setOpen(true),180);}} onPointerLeave={()=>clearTimeout(timer.current)} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)}>{person(info.editedBy).avatarUrl?<img src={person(info.editedBy).avatarUrl!} alt=""/>:<span className="editor-menu-editor-avatar" aria-hidden>{info.editedBy.slice(0,1)}</span>}<span>{info.editedBy}</span></button><DateLabel value={info.editedAt}>{date(info.editedAt)}</DateLabel>
    {open&&trigger.current?<RichPopover anchor={trigger.current} owner={owner} side="right" level={114} initialFocus="none" width={340} label={t('title')} onClose={()=>setOpen(false)} className="editor-block-activity">{([{name:info.editedBy,time:info.editedAt,action:'edited'},...(info.createdBy&&info.createdAt?[{name:info.createdBy,time:info.createdAt,action:'created'}]:[])]).map(row=><div className="editor-block-activity-row" key={row.action}><span>{t(row.action)}</span><CommentAvatar person={person(row.name)} me="" showName owner={owner}/><DateLabel value={row.time}>{activityTime(row.time,locale,t('justNow'),'compact')}</DateLabel></div>)}</RichPopover>:null}
  </>:<small>{t('noHistory')}</small>}</div>;
}
