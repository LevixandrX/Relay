import { useTranslations } from "use-intl";
import type { ReactNode } from "react";
import type { BlockType } from "./block-commands";
export function BlockGlyph({ type }: { type: string }) {
  if (type === "text" || /^h[123]$/.test(type)) return <span className="editor-tool-letter" aria-hidden>{type === "text" ? "T" : `H${type[1]}`}</span>;
  const paths: Record<string, ReactNode> = {
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
  return <svg viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
}
export function BlockPreview({ type }: { type: BlockType }) {
  const t = useTranslations("editorTools");
  const sample = t("sample");
  return <><div className="editor-block-example" data-type={type} aria-hidden>
    {type.startsWith("h") ? <strong className={`example-${type}`}>{t("sampleHeading")}</strong> :
    type === "code" ? <code>const idea = "Relay";<br />share(idea);</code> :
    type === "divider" ? <><span>{sample}</span><hr /><span>{t("sampleSecond")}</span></> :
    type === "todo" ? <><span>☑ {sample}</span><span>☐ {t("sampleSecond")}</span></> :
    type === "bullet" || type === "numbered" ? <><span>{type === "bullet" ? "•" : "1."} {sample}</span><span>{type === "bullet" ? "•" : "2."} {t("sampleSecond")}</span></> :
    type === "callout" ? <span>💡 {sample}</span> :
    type === "quote" ? <blockquote>{sample}</blockquote> :
    type === "prompt" ? <span>✦ {t("samplePrompt")}</span> : <><span>{sample}</span><span className="example-muted">{t("sampleSecond")}</span></>}
  </div><strong>{t(`blocks.${type}`)}</strong><p>{t(`descriptions.${type}`)}</p></>;
}
