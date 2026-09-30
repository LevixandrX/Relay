"use client";

export type ContentMode = "board" | "text";

export function ContentModeSwitch({
  value,
  onChange,
  boardLabel,
  textLabel,
  compact = false,
  className = "",
}: {
  value: ContentMode;
  onChange: (mode: ContentMode) => void;
  boardLabel: string;
  textLabel: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relay-content-mode-switch ${className}`.trim()}
      data-mode={value}
      data-compact={compact || undefined}
      role="tablist"
      aria-label={`${boardLabel} / ${textLabel}`}
    >
      <span className="relay-content-mode-indicator" aria-hidden />
      <button
        type="button"
        role="tab"
        aria-selected={value === "board"}
        data-active={value === "board" || undefined}
        onClick={() => onChange("board")}
      >
        <BoardModeIcon />
        <span>{boardLabel}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "text"}
        data-active={value === "text" || undefined}
        onClick={() => onChange("text")}
      >
        <TextModeIcon />
        <span>{textLabel}</span>
      </button>
    </div>
  );
}

function BoardModeIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden>
      <rect x="2.25" y="2.25" width="5.25" height="5.25" rx="1.15" />
      <rect x="10.5" y="2.25" width="5.25" height="5.25" rx="1.15" />
      <rect x="2.25" y="10.5" width="5.25" height="5.25" rx="1.15" />
      <path d="M10.75 13.15h4.7M13.1 10.8v4.7" />
    </svg>
  );
}

function TextModeIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden>
      <path d="M3 3.25h12M6.25 3.25v11.5M3.7 14.75h5.1M10.75 8.2H15M10.75 11.45H15M10.75 14.7h3.1" />
    </svg>
  );
}
