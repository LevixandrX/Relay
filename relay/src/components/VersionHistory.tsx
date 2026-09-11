"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "use-intl";

export type RevisionSummary = {
  id: string;
  title: string;
  createdAt: string;
  createdByName: string | null;
  kind: "text" | "board" | "both";
  hasBoard: boolean;
};

export type RevisionDetail = {
  id: string;
  title: string;
  content: { type: string; content?: unknown[] } | null;
  board: unknown;
  createdAt: string;
  createdByName: string | null;
};

export type HistoryClient = {
  list: () => Promise<{ revisions: RevisionSummary[] }>;
  get: (id: string) => Promise<RevisionDetail>;
  restore: (id: string) => Promise<void>;
};

type DocNode = {
  type?: string;
  text?: string;
  content?: DocNode[];
};

function plainFromDoc(doc: RevisionDetail["content"]) {
  if (!doc || !Array.isArray(doc.content)) return "";
  const out: string[] = [];
  const walk = (nodes: DocNode[]) => {
    for (const node of nodes) {
      if (node.text) out.push(node.text);
      if (node.content) walk(node.content);
      if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
        out.push("\n");
      }
    }
  };
  walk(doc.content as DocNode[]);
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function boardCount(board: unknown) {
  if (!board || typeof board !== "object") return 0;
  const rec = board as Record<string, unknown>;
  for (const key of ["objects", "shapes", "elements", "nodes"]) {
    const value = rec[key];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
  }
  return 0;
}

function formatWhen(iso: string, locale: string) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export function VersionHistory({
  open,
  title,
  canRestore,
  client,
  onClose,
  onRestored,
}: {
  open: boolean;
  title: string;
  canRestore: boolean;
  client: HistoryClient;
  onClose: () => void;
  onRestored?: () => void;
}) {
  const t = useTranslations("app");
  const locale = useLocale();
  const clientRef = useRef(client);
  clientRef.current = client;
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RevisionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    void clientRef.current.list().then((data) => {
      if (cancelled) return;
      setRevisions(data.revisions);
      setSelected(data.revisions[0]?.id ?? null);
    }).catch(() => {
      if (!cancelled) setError(t("historyLoadFailed"));
    });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  useEffect(() => {
    if (!open || !selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void clientRef.current.get(selected).then((row) => {
      if (!cancelled) setDetail(row);
    }).catch(() => {
      if (!cancelled) setDetail(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const previewText = plainFromDoc(detail?.content ?? null);
  const objects = boardCount(detail?.board);
  const kindLabel = (kind: RevisionSummary["kind"]) =>
    kind === "board" ? t("historyKindBoard") : kind === "both" ? t("historyKindBoth") : t("historyKindText");

  return createPortal(
    <div className="version-history" role="dialog" aria-label={t("historyTitle")}>
      <div className="version-history-preview">
        <div className="version-history-preview-head">
          <h2>{detail?.title || title || t("untitled")}</h2>
          {detail ? (
            <p>
              {formatWhen(detail.createdAt, locale)}
              {detail.createdByName ? ` · ${detail.createdByName}` : ""}
            </p>
          ) : null}
        </div>
        <div className="version-history-preview-body">
          {previewText ? <pre>{previewText}</pre> : null}
          {objects > 0 ? (
            <p className="version-history-board">{t("historyBoardCount", { count: objects })}</p>
          ) : null}
          {!previewText && objects === 0 ? (
            <p className="version-history-empty">{t("historyPreviewEmpty")}</p>
          ) : null}
        </div>
      </div>
      <aside className="version-history-side">
        <header className="version-history-side-head">
          <strong>{t("historyTitle")}</strong>
          <button type="button" className="version-history-close" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>
        <div className="version-history-list">
          {error ? <p className="version-history-empty">{error}</p> : null}
          {!error && revisions.length === 0 ? (
            <p className="version-history-empty">{t("historyEmpty")}</p>
          ) : null}
          {revisions.map((row) => (
            <button
              key={row.id}
              type="button"
              className="version-history-item"
              data-active={row.id === selected || undefined}
              onClick={() => setSelected(row.id)}
            >
              <span>{formatWhen(row.createdAt, locale)}</span>
              <span>
                {row.createdByName || t("historySomeone")} · {kindLabel(row.kind)}
              </span>
            </button>
          ))}
        </div>
        <footer className="version-history-foot">
          <span>{t("historyHint")}</span>
          {canRestore && selected ? (
            <button
              type="button"
              className="btn btn-accent"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await clientRef.current.restore(selected);
                    onRestored?.();
                    onClose();
                  } catch {
                    setError(t("historyRestoreFailed"));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {t("historyRestore")}
            </button>
          ) : null}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
