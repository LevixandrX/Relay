"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { OverlayScroll } from "../lib/board/CompactRailScroll";

export type SearchHit = {
  id: string;
  title: string;
  snippet?: string;
};

export type SearchAction = {
  id: string;
  title: string;
  icon?: ReactNode;
  onSelect: () => void;
};

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="palette-mark">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function SearchPalette({
  open,
  onClose,
  query,
  onQueryChange,
  label,
  placeholder,
  actionsLabel,
  pagesLabel,
  emptyLabel,
  emptyHint,
  actions,
  hits,
  onOpenHit,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  label: string;
  placeholder: string;
  actionsLabel: string;
  pagesLabel: string;
  emptyLabel: string;
  emptyHint?: string;
  actions: SearchAction[];
  hits: SearchHit[];
  onOpenHit: (id: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const searching = query.trim().length > 0;

  return (
    <>
    <div className="palette-backdrop" onClick={onClose} role="presentation" />
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="palette-field">
          <SearchGlyph />
          <input
            className="palette-input"
            autoFocus
            value={query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>

        <OverlayScroll contentClassName="palette-list">
          {!searching ? (
            <>
              <div className="palette-section">{actionsLabel}</div>
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="palette-item"
                  onClick={() => {
                    onClose();
                    action.onSelect();
                  }}
                >
                  {(() => {
                    const ico = action.icon ?? defaultActionIcon(action.id);
                    return ico ? <span className="palette-item-ico">{ico}</span> : null;
                  })()}
                  <span className="palette-item-title">{action.title}</span>
                </button>
              ))}
            </>
          ) : null}

          {searching && hits.length === 0 ? (
            <div className="palette-empty-state">
              <span className="palette-empty-ico" aria-hidden>
                <SearchGlyph />
              </span>
              <strong>{emptyLabel}</strong>
              {emptyHint ? <p>{emptyHint}</p> : null}
            </div>
          ) : (
            <>
              <div className="palette-section">{pagesLabel}</div>
              {hits.length === 0 ? (
                <div className="palette-empty-state">
                  <span className="palette-empty-ico" aria-hidden>
                    <SearchGlyph />
                  </span>
                  <strong>{emptyLabel}</strong>
                  {emptyHint ? <p>{emptyHint}</p> : null}
                </div>
              ) : (
                hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="palette-item palette-item-stack"
                    onClick={() => {
                      onClose();
                      onOpenHit(hit.id);
                    }}
                  >
                    <span className="palette-item-row">
                      <span className="palette-item-ico">
                        <PageGlyph />
                      </span>
                      <span className="palette-item-title">
                        <Highlight text={hit.title} query={query} />
                      </span>
                    </span>
                    {hit.snippet ? (
                      <span className="palette-item-snip">
                        <Highlight text={hit.snippet} query={query} />
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </>
          )}
        </OverlayScroll>
      </div>
    </>
  );
}

function defaultActionIcon(id: string) {
  if (id === "board") return <BoardGlyph />;
  if (id === "new") return <PlusGlyph />;
  return null;
}

function BoardGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5.5v13M5.5 12h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PageGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7.2L19.5 9v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V9h5.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg
      className="palette-field-ico"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 3.7 3.7" />
    </svg>
  );
}
