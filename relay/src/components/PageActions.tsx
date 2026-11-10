"use client";

import { Check, Ellipsis, History, Link, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { OverlayPresence } from "../editor/EditorOverlay";
import { RichPopover } from "../editor/RichPopover";

export function PageActions({ pageUrl, publicUrl, onRename, onHistory, onDelete }: {
  pageUrl?: string | null;
  publicUrl?: string | null;
  onRename?: () => void;
  onHistory?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("app");
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [feedback, setFeedback] = useState<{ url: string; ok: boolean } | null>(null);
  const timer = useRef(0);
  const request = useRef(0);
  useEffect(() => () => { clearTimeout(timer.current); request.current++; }, []);

  function close() {
    request.current++;
    clearTimeout(timer.current);
    setFeedback(null);
    setAnchor(null);
  }

  async function copy(url: string) {
    const current = ++request.current;
    clearTimeout(timer.current);
    let ok = true;
    try { await navigator.clipboard.writeText(url); }
    catch { ok = false; }
    if (current !== request.current) return;
    setFeedback({ url, ok });
    timer.current = window.setTimeout(() => setFeedback(null), 1700);
  }

  function run(action: () => void, returnFocus = false) {
    if (returnFocus) anchor?.focus({ preventScroll: true });
    close();
    action();
  }

  const links = [
    { url: pageUrl, label: t("pageMenuCopyLink") },
    { url: publicUrl, label: t("pageMenuCopyPublic") },
  ];
  return (
    <>
      <button
        type="button"
        className="relay-page-control"
        aria-label={t("pageMenu")}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => { if (anchor) close(); else setAnchor(event.currentTarget); }}
      >
        <Ellipsis aria-hidden />
      </button>
      <OverlayPresence visible={Boolean(anchor)}>
        {anchor && (
          <RichPopover anchor={anchor} label={t("pageMenu")} onClose={close} width={228} initialFocus="first" className="relay-page-actions">
            {onRename && <button type="button" className="rich-menu-row" onClick={() => run(onRename)}><Pencil aria-hidden /><span>{t("pageMenuRename")}</span></button>}
            {links.map(({ url, label }) => url && (
              <button key={label} type="button" className="rich-menu-row" onClick={() => void copy(url)}>
                {feedback?.url === url && feedback.ok ? <Check aria-hidden /> : <Link aria-hidden />}
                <span>{feedback?.url === url ? t(feedback.ok ? "pageMenuCopied" : "pageMenuCopyFailed") : label}</span>
              </button>
            ))}
            <span className="relay-visually-hidden" role="status">{feedback ? t(feedback.ok ? "pageMenuCopied" : "pageMenuCopyFailed") : ""}</span>
            {onHistory && <button type="button" className="rich-menu-row" onClick={() => run(onHistory, true)}><History aria-hidden /><span>{t("pageMenuHistory")}</span></button>}
            {onDelete && (
              <>
                <div className="relay-page-actions-divider" role="separator" />
                <button type="button" className="rich-menu-row" data-danger="true" onClick={() => run(onDelete, true)}><Trash2 aria-hidden /><span>{t("pageMenuDelete")}</span></button>
              </>
            )}
          </RichPopover>
        )}
      </OverlayPresence>
    </>
  );
}
