import { useTranslations } from "use-intl";
import type { ReactNode } from "react";
import type { BlockType } from "./block-commands";
export function BlockGlyph({ type }: { type: string }) {
  if (type === "text" || /^h[1234]$/.test(type)) return <span className="editor-tool-letter" aria-hidden>{type === "text" ? "T" : `H${type[1]}`}</span>;
  if(/^toggleH[1-4]$/.test(type))return <svg className="editor-toggle-heading-glyph" viewBox="0 0 24 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"><path d="m1 7 4 3-4 3Z" fill="currentColor" stroke="none"/><path d="M8 5v10m7-10v10M8 10h7"/><text x="17" y="15" fill="currentColor" stroke="none" fontSize="10" fontFamily="system-ui,sans-serif">{type.slice(-1)}</text></svg>;
  if(type.startsWith('columns'))return <svg viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="3" width="16" height="14" rx="1"/>{Array.from({length:Number(type.slice(-1))-1},(_,i)=><path key={i} d={`M${2+16*(i+1)/Number(type.slice(-1))} 3v14`}/>)}</svg>;
  const paths: Record<string, ReactNode> = {
    fitWidth:<path d="M2 3v14M18 3v14M3 10h14M6 7l-3 3 3 3m8-6 3 3-3 3"/>,
    headerRow:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M2 8h16M8 3v14"/><path d="M3 4h14v3H3Z" fill="currentColor" stroke="none"/></>,
    headerColumn:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M7 3v14M2 10h16"/><path d="M3 4h3v12H3Z" fill="currentColor" stroke="none"/></>,
    rowAbove:<path d="M2 8h16v9H2ZM10 1v5M7 3l3-3 3 3M2 12h16"/>,rowBelow:<path d="M2 2h16v9H2ZM10 14v5M7 17l3 3 3-3M2 6h16"/>,
    columnBefore:<path d="M8 2h10v16H8ZM1 10h5M3 7l-3 3 3 3M13 2v16"/>,columnAfter:<path d="M2 2h9v16H2ZM14 10h5M17 7l3 3-3 3M6 2v16"/>,
    deleteRow:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M2 8h16M2 12h16m-5-3 3 3m0-3-3 3"/></>,
    deleteColumn:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M7 3v14M12 3v14m1 5 3 4m0-4-3 4"/></>,
    tableRows:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M2 8h16M2 12h16"/></>,tableColumns:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M7 3v14M13 3v14"/></>,tableCells:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M10 3v14M2 10h16"/></>,
    cellGrip:<><circle cx="10" cy="5" r="1" fill="currentColor"/><circle cx="10" cy="10" r="1" fill="currentColor"/><circle cx="10" cy="15" r="1" fill="currentColor"/></>,
    clearContents:<><circle cx="10" cy="10" r="7"/><path d="m7 7 6 6m0-6-6 6"/></>,
    left:<path d="M17 10H3m6-6-6 6 6 6"/>,right:<path d="M3 10h14m-6-6 6 6-6 6"/>,
    chevronRight:<path d="m7 4 6 6-6 6"/>,
    download:<path d="M10 2v11m-4-4 4 4 4-4M3 14v4h14v-4"/>,
    mergeCells:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="m6 7 3 3-3 3m8-6-3 3 3 3"/></>,
    splitCell:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M10 3v14m-4-10-3 3 3 3m8-6 3 3-3 3"/></>,
    moveTo:<path d="M7 5H3v12h14V8M10 2h8v8M18 2 7 13"/>,
    wrap:<path d="M2 4h16M2 9h12a4 4 0 0 1 0 8h-4m3-3-3 3 3 3M2 14h4"/>,
    caption:<><rect x="2" y="2" width="16" height="11" rx="1"/><path d="M5 17h10"/></>,
    bold:<path strokeWidth="2" d="M6 3h5a3.5 3.5 0 0 1 0 7H6m5 0a3.5 3.5 0 0 1 0 7H6V3"/>,
    italic:<path d="M9 3h7M4 17h7M13 3 7 17"/>,
    underline:<path d="M5 3v6a5 5 0 0 0 10 0V3M3 18h14"/>,
    strike:<path d="M14 5c-2-4-9-3-9 1 0 5 10 3 10 8 0 4-8 5-10 1M2 10h16"/>,
    clear:<path d="M3 4h12M9 4v12M4 16h7M14 12l5 6m0-6-5 6"/>,
    toggle:<path d="m5 3 10 7-10 7Z"/>, toggleOpen:<path d="m4 7 6 6 6-6"/>,
    table:<><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M2 8h16M2 12h16M8 3v14M13 3v14"/></>,
    image:<><rect x="2" y="3" width="16" height="14" rx="2"/><circle cx="7" cy="7" r="1.5"/><path d="m2 15 5-5 4 4 3-5 4 6"/></>,
    video:<><rect x="2" y="4" width="16" height="12" rx="2"/><path d="m8 7 5 3-5 3Z"/></>,
    audio:<><path d="M8 14V4l9-2v10M8 7l9-2"/><circle cx="5" cy="15" r="3"/><circle cx="14" cy="13" r="3"/></>,
    file:<><path d="M4 2h8l4 4v12H4ZM12 2v5h4"/></>,pdf:<><path d="M4 2h8l4 4v12H4ZM12 2v5h4"/><text x="5" y="14" fontSize="5" stroke="none" fill="currentColor">PDF</text></>,
    bookmark:<path d="M5 2h10v16l-5-4-5 4Z"/>,embed:<path d="m6 5-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>,
    equation:<path d="M15 3H5l6 7-6 7h10"/>,toc:<><path d="M7 4h11M7 10h11M7 16h11M2 4h1M2 10h1M2 16h1"/></>,pageLink:<><path d="M4 2h8l4 4v12H4ZM12 2v5h4M7 11h6m-3-3 3 3-3 3"/></>,
    editSource:<><path d="m4 13 9-9 3 3-9 9H4v-3m7-7 3 3M3 18h14"/></>,
    selectParent: <><rect x="2" y="3" width="16" height="14" rx="2" strokeDasharray="2 2"/><path d="M5 7h10M5 10h10M5 13h6"/></>,
    replace: <><path d="M16 8a6 6 0 0 0-10-3L3 8m0-4v4h4M4 12a6 6 0 0 0 10 3l3-3m0 4v-4h-4"/></>,
    markUnread: <><rect x="3" y="4" width="13" height="13" rx="2"/><circle cx="16" cy="4" r="2.5" fill="currentColor" stroke="none"/></>,
    edit: <><path d="m4 13 9-9 3 3-9 9H4v-3m7-7 3 3M3 18h14"/></>,
    mute: <><path d="M6 7a4 4 0 0 1 8 0v4l2 3H4l2-3V7m2 10h4M3 2l14 16"/></>,
    mention: <><circle cx="9" cy="10" r="3.3" /><path d="M12.3 6.7v6a2 2 0 0 0 4 0V10a7 7 0 1 0-3 5.7" /></>,
    customEmoji: <><rect x="2.5" y="2.5" width="15" height="15" rx="3" /><circle cx="6.6" cy="6.6" r="1.2" /><path d="m3 14 4-4 3 3 3.5-5 4 6" /></>,
    addComment: <path d="M3 3h14v11H9l-5 4v-4H3V3m7 3v5m-2.5-2.5h5" />,
    color: <><rect x="3" y="2" width="11" height="6" rx="1.5"/><path d="M14 4h3v6h-7v3M8 13h4v5H8z"/></>,
    comment: <path d="M3 3h14v11H9l-5 4v-4H3V3m3 4h8M6 10h5" />,
    copyLink: <path d="m8 7 2-2a4 4 0 0 1 6 6l-2 2M6 7l-2 2a4 4 0 0 0 6 6l2-2M7 13l6-6" />,
    link: <path d="m8 7 2-2a4 4 0 0 1 6 6l-2 2M6 7l-2 2a4 4 0 0 0 6 6l2-2M7 13l6-6" />,
    attach: <path d="m7 12 6-6a2 2 0 0 1 3 3l-7 7a4 4 0 0 1-6-6l7-7" />,
    resolve: <path d="m4 10 4 4 8-9" />,
    close: <path d="m5 5 10 10M15 5 5 15" />,
    more: <>{[4,10,16].map((x) => <circle key={x} cx={x} cy="10" r="1" />)}</>,
    react: <><circle cx="9" cy="9" r="7" /><path d="M6 7h.1M11 7h.1M5 10q4 5 8 0M16 12v6m-3-3h6" /></>,
    add: <path d="M10 3v14M3 10h14" />,
    grip: <>{[5, 10, 15].flatMap((y) => [7, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" stroke="none" />))}</>,
    bullet: <><path d="M8 5h8M8 10h8M8 15h8" /><path d="M4 5h.1M4 10h.1M4 15h.1" strokeWidth="3" /></>,
    numbered: <><path d="M8 5h8M8 10h8M8 15h8" /><text x="1" y="8" stroke="none" fill="currentColor" fontSize="7">1</text><text x="1" y="16" stroke="none" fill="currentColor" fontSize="7">2</text></>,
    todo: <><rect x="3" y="3" width="14" height="14" rx="2" /><path d="m6 10 3 3 5-6" /></>,
    quote: <path d="M4 12V7h5v6H4m9-1V7h5v6h-5M4 7l2-3m7 3 2-3" />,
    code: <path d="m6 5-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" />,
    callout: <><rect x="2" y="3" width="16" height="14" rx="2" /><path d="M10 6v5m0 3h.01" /></>,
    divider: <path d="M2 10h16" />,
    prompt: <path d="m10 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />,
    addAbove: <><path d="M3 15h14M10 2v9M6 6h8" /></>,
    addBelow: <><path d="M3 5h14M10 9v9M6 14h8" /></>,
    duplicate: <><rect x="7" y="7" width="10" height="10" rx="1" /><path d="M13 7V3H3v10h4" /></>,
    copy: <><rect x="5" y="3" width="12" height="14" rx="1" /><path d="M8 7h6M8 10h6M8 13h4" /></>,
    delete: <><path d="M3 5h14M7 5V2h6v3M5 5l1 13h8l1-13M8 8v7m4-7v7" /></>,
    up: <path d="m4 10 6-6 6 6M10 4v13" />,
    down: <path d="m4 10 6 6 6-6M10 3v13" />,
    turn: <path d="M3 5h13l-3-3m3 3-3 3M17 15H4l3-3m-3 3 3 3" />,
  };
  const aliases:Record<string,string>={inlineMath:'equation',page:'pageLink',codeLanguage:'code',codeWrap:'wrap',codeCaption:'caption',copyCode:'copy',codeSelect:'selectParent',codeDownload:'download',editIcon:'react'};
  return <svg className={type==='chevronRight'?'editor-menu-chevron-glyph':undefined} viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{paths[aliases[type]??type]??paths.table}</svg>;
}
export function BlockPreview({ type }: { type: BlockType }) {
  const t = useTranslations("editorTools");
  const sample = t("sample");
  return <><div className="editor-block-example" data-type={type} aria-hidden>
    {type.startsWith("h") ? <strong className={`example-${type}`}>{t("sampleHeading")}</strong> :
    type.startsWith('columns') ? <div style={{display:'flex',gap:8}}>{Array.from({length:Number(type.slice(-1))},(_,i)=><span key={i} style={{flex:1,border:'1px solid var(--line)',padding:6}}>Aa</span>)}</div> :
    type==='table'?<table><tbody>{[1,2,3].map(i=><tr key={i}>{[1,2,3].map(j=><td key={j} style={{border:'1px solid var(--line)',padding:6}}>Aa</td>)}</tr>)}</tbody></table>:
    type.startsWith('toggle')?<><strong>▸ {t('sampleHeading')}</strong><span>{sample}</span></>:
    ['image','video','audio','file','pdf','embed','bookmark','equation','toc','pageLink'].includes(type)?<><BlockGlyph type={type}/><span>{t(`blocks.${type}`)}</span></>:
    type === "code" ? <code>const idea = "Relay";<br />share(idea);</code> :
    type === "divider" ? <><span>{sample}</span><hr /><span>{t("sampleSecond")}</span></> :
    type === "todo" ? <><span>☑ {sample}</span><span>☐ {t("sampleSecond")}</span></> :
    type === "bullet" || type === "numbered" ? <><span>{type === "bullet" ? "•" : "1."} {sample}</span><span>{type === "bullet" ? "•" : "2."} {t("sampleSecond")}</span></> :
    type === "callout" ? <span>💡 {sample}</span> :
    type === "quote" ? <blockquote>{sample}</blockquote> :
    type === "prompt" ? <span>✦ {t("samplePrompt")}</span> : <><span>{sample}</span><span className="example-muted">{t("sampleSecond")}</span></>}
  </div><strong>{t(`blocks.${type}`)}</strong><p>{t(`descriptions.${type}`)}</p></>;
}
