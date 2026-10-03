"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "use-intl";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import { ContentModeSwitch } from "./ContentModeSwitch";

export type HistorySpan = { t: string; m?: "add" | "del"; href?: string };

export type HistoryBlock = {
  type:
    | "title"
    | "heading"
    | "quote"
    | "code"
    | "paragraph"
    | "list"
    | "todo"
    | "callout"
    | "image"
    | "embed"
    | "rule"
    | "board";
  level?: number;
  language?: string | null;
  ordered?: boolean;
  checked?: boolean;
  checks?: boolean[];
  action?: "add" | "del" | "edit" | "move";
  shape?: string;
  count?: number;
  targetIds?: string[];
  spans?: HistorySpan[];
  lines?: HistorySpan[][];
  items?: HistorySpan[][];
};

export type RevisionSummary = {
  id: string;
  restoreId: string | null;
  title: string;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByAvatar: string | null;
  baseline: boolean;
  blocks: HistoryBlock[];
  more: number;
  pageId?: string | null;
  scope?: "page" | "board";
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

const LANG: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  bash: "Bash",
  markdown: "Markdown",
  jsx: "JSX",
  tsx: "TSX",
};

function formatWhen(iso: string, locale: string, justNow: string) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const delta = Date.now() - ts;
  if (delta >= 0 && delta < 10 * 60 * 1000) return justNow;
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(date);
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().slice(0, 1).toUpperCase() || "?";
  if (url && !failed) {
    return (
      <img className="vh-avatar" src={url} alt="" draggable={false} onError={() => setFailed(true)} />
    );
  }
  return (
    <span className="vh-avatar" aria-hidden>
      {letter}
    </span>
  );
}

function Spans({ spans }: { spans?: HistorySpan[] }) {
  if (!spans?.length) return null;
  return (
    <>
      {spans.map((span, index) => {
        const cls = [
          span.m === "add" ? "vh-add" : "",
          span.m === "del" ? "vh-del" : "",
          span.href ? "vh-link" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={index} className={cls || undefined}>
            {span.t}
          </span>
        );
      })}
    </>
  );
}

export function UpdateCard({
  row,
  title,
  viewerId,
  onViewVersion,
  onOpen,
}: {
  row: RevisionSummary;
  title: string;
  viewerId?: string | null;
  onViewVersion?: (row: RevisionSummary) => void;
  onOpen?: (row: RevisionSummary, block: HistoryBlock) => void;
}) {
  const t = useTranslations("app");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, row.blocks.length - 6);
  const visibleBlocks = expanded ? row.blocks : row.blocks.slice(0, 6);
  const you = Boolean(viewerId && row.createdBy === viewerId);
  const pageTitle = row.title.trim() || title.trim() || t("untitled");
  const who = row.baseline
    ? t("historyEarlier")
    : you
      ? t("historyEditedYou", { title: pageTitle })
      : t("historyEditedName", {
          name: row.createdByName || t("historySomeone"),
          title: pageTitle,
        });
  return (
    <article className="version-history-item">
      <Avatar name={row.createdByName || t("historySomeone")} url={row.createdByAvatar} />
      <span className="vh-meta">
        <span className="vh-who">{who}</span>
        <span className="vh-when">{formatWhen(row.createdAt, locale, t("historyJustNow"))}</span>
      </span>
      {onViewVersion ? (
        <button
          type="button"
          className="vh-view"
          title={t("activityViewVersion")}
          aria-label={t("activityViewVersion")}
          onClick={(event) => {
            event.stopPropagation();
            onViewVersion(row);
          }}
        >
          <ClockIcon />
        </button>
      ) : null}
      <div className="vh-card">
        {visibleBlocks.map((block, index) => (
          <div
            key={index}
            className="vh-change"
            data-type={block.type}
            data-tone={block.action === "del" ? "del" : [...(block.spans ?? []), ...(block.lines ?? []).flat(), ...(block.items ?? []).flat()].some((span) => span.m === "add") ? "add" : undefined}
            data-clickable={onOpen ? "true" : undefined}
            role={onOpen ? "button" : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onClick={() => onOpen?.(row, block)}
            onKeyDown={(event) => {
              if (!onOpen || (event.key !== "Enter" && event.key !== " ")) return;
              event.preventDefault();
              onOpen(row, block);
            }}
          >
            <BlockView block={block} />
          </div>
        ))}
        {hiddenCount > 0 ? (
          <button type="button" className="vh-expand" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? t("historyShowLess") : t("historyViewMore", { count: hiddenCount })}
          </button>
        ) : null}
        {row.more > 0 ? <span className="vh-more">{t("historyMore", { count: row.more })}</span> : null}
      </div>
    </article>
  );
}

export function VersionHistory({
  open,
  title,
  canRestore,
  client,
  initialId,
  loadCurrent,
  renderBoard,
  onClose,
  onRestored,
}: {
  open: boolean;
  title: string;
  canRestore: boolean;
  viewerId?: string | null;
  client: HistoryClient;
  initialId?: string | null;
  loadCurrent: () => Promise<{ title: string; content: unknown; board: unknown }>;
  renderBoard?: (board: unknown) => ReactNode;
  onClose: () => void;
  onRestored?: () => void;
}) {
  const t = useTranslations("app");
  const locale = useLocale();
  const clientRef = useRef(client);
  clientRef.current = client;
  const loadCurrentRef = useRef(loadCurrent);
  loadCurrentRef.current = loadCurrent;
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ title: string; content: unknown; board: unknown } | null>(null);
  const [mode, setMode] = useState<"text" | "board">("text");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setLoaded(false);
    setSnapshot(null);
    void clientRef.current
      .list()
      .then((data) => {
        if (cancelled) return;
        const rows = data.revisions ?? [];
        setRevisions(rows);
        const pick = rows.find((row) => row.id === initialId)?.id ?? rows[0]?.id ?? null;
        setSelected(pick);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("historyLoadFailed"));
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialId, t]);

  const current = revisions.find((row) => row.id === selected) ?? null;
  const modes = modesOf(current);

  useEffect(() => {
    if (!open || !current) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    // Quickdraw owns an internal store created from the initial snapshot. Clear
    // the previous preview before loading another revision so the board is
    // unmounted and rebuilt from the selected revision instead of reusing that
    // store with new props.
    setSnapshot(null);
    const run = current.restoreId
      ? clientRef.current.get(current.restoreId).then((row) => ({
          title: row.title,
          content: row.content,
          board: row.board,
        }))
      : loadCurrentRef.current();
    void run
      .then((row) => {
        if (!cancelled) setSnapshot(row);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, current]);

  useEffect(() => {
    if (!modes.includes(mode)) setMode(modes[0] ?? "text");
  }, [modes, mode]);

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

  const added = phrases(current, "add");
  const removed = phrases(current, "del");
  const showSwitcher = modes.length > 1;

  return createPortal(
    <>
      <div className="version-history-backdrop" aria-hidden onPointerDown={onClose} />
      <div className="version-history" role="dialog" aria-modal="true" aria-label={t("historyTitle")}>
      <div className="version-stage" data-switcher={showSwitcher || undefined}>
        {showSwitcher ? (
          <div className="version-mode-bar">
            <ContentModeSwitch
              className="version-mode"
              compact
              value={mode}
              onChange={setMode}
              boardLabel={t("board")}
              textLabel={t("text")}
            />
          </div>
        ) : null}
        {mode === "board" ? (
          <div className="version-stage-body" data-mode="board">
            <div className="version-stage-board">
              {snapshot?.board && renderBoard ? (
                <div className="version-stage-board-snapshot" key={selected}>
                  {renderBoard(snapshot.board)}
                </div>
              ) : (
                <p className="version-history-empty">{t("historyPreviewEmpty")}</p>
              )}
            </div>
          </div>
        ) : (
          <OverlayScroll arrows className="version-stage-scroll" contentClassName="version-stage-body">
            <article className="version-doc">
              <h1>{snapshot?.title || title || t("untitled")}</h1>
              {removed.length > 0 ? (
                <div className="version-deleted">
                  <span>{t("activityDeleted")}</span>
                  {removed.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </div>
              ) : null}
              <DocPreview content={snapshot?.content} added={added} />
            </article>
          </OverlayScroll>
        )}
      </div>
      <aside className="version-history-side">
        <header className="version-history-side-head">
          <strong>{t("historyTitle")}</strong>
          <button type="button" className="version-history-close" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>
        <OverlayScroll arrows className="version-history-list-scroll" contentClassName="version-history-list">
          {error ? <p className="version-history-empty">{error}</p> : null}
          {loaded && !error && revisions.length === 0 ? (
            <p className="version-history-empty">{t("historyEmpty")}</p>
          ) : null}
          {revisions.map((row) => (
            <button
              key={row.id}
              type="button"
              className="version-row"
              data-active={row.id === selected || undefined}
              onClick={() => setSelected(row.id)}
            >
              <span>{formatVersionWhen(row.createdAt, locale, t("historyYesterday"))}</span>
              <span>{row.createdByName || t("historySomeone")}</span>
            </button>
          ))}
        </OverlayScroll>
        <footer className="version-history-foot">
          <span>{current && !current.restoreId ? t("historyCurrent") : t("historyHint")}</span>
          {canRestore && current?.restoreId ? (
            <button
              type="button"
              className="btn btn-accent"
              disabled={busy}
              onClick={() => {
                const restoreId = current.restoreId;
                if (!restoreId) return;
                void (async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await clientRef.current.restore(restoreId);
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
      </div>
    </>,
    document.body,
  );
}

function modesOf(row: RevisionSummary | null): Array<"text" | "board"> {
  if (!row) return ["text"];
  const board = row.blocks.some((block) => block.type === "board");
  const text = row.blocks.some((block) => block.type !== "board");
  if (text && board) return ["text", "board"];
  if (board) return ["board"];
  return ["text"];
}

function phrases(row: RevisionSummary | null, mark: "add" | "del") {
  if (!row) return [];
  const found = new Set<string>();
  const take = (spans?: HistorySpan[]) => {
    for (const span of spans ?? []) {
      if (span.m === mark && span.t.trim().length > 1) found.add(span.t.trim());
    }
  };
  for (const block of row.blocks) {
    take(block.spans);
    for (const line of block.lines ?? []) take(line);
    for (const item of block.items ?? []) take(item);
  }
  return [...found].slice(0, 8);
}

function formatVersionWhen(iso: string, locale: string, yesterday: string) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const date = new Date(ts);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const prior = new Date(start);
  prior.setDate(prior.getDate() - 1);
  if (date >= start) return time;
  if (date >= prior) return `${yesterday} · ${time}`;
  const day = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(date);
  return `${day} · ${time}`;
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.5V12l2.4 1.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DocPreview({ content, added }: { content: unknown; added: string[] }) {
  const nodes = docNodes(content);
  if (nodes.length === 0) return null;
  return (
    <div className="version-doc-body">
      {nodes.map((node, index) => (
        <DocBlock key={index} node={node} added={added} />
      ))}
    </div>
  );
}

function docNodes(content: unknown): Record<string, unknown>[] {
  if (!content || typeof content !== "object") return [];
  const nodes = (content as { content?: unknown }).content;
  if (!Array.isArray(nodes)) return [];
  return nodes.filter((node) => node && typeof node === "object") as Record<string, unknown>[];
}

function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { text?: string; content?: unknown[] };
  if (typeof record.text === "string") return record.text;
  return (record.content ?? []).map(nodeText).join("");
}

function isAdded(text: string, added: string[]) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return added.some((phrase) => trimmed.includes(phrase) || phrase.includes(trimmed));
}

function DocBlock({ node, added }: { node: Record<string, unknown>; added: string[] }) {
  const type = String(node.type ?? "");
  const text = nodeText(node);
  const marked = isAdded(text, added);
  if (type === "heading") {
    const level = Number((node.attrs as { level?: number } | undefined)?.level ?? 1);
    const Tag = (level <= 1 ? "h2" : "h3") as "h2" | "h3";
    return <Tag data-added={marked || undefined}>{text}</Tag>;
  }
  if (type === "blockquote") return <blockquote data-added={marked || undefined}>{text}</blockquote>;
  if (type === "codeBlock") return <pre data-added={marked || undefined}>{text}</pre>;
  if (type === "bulletList" || type === "orderedList" || type === "taskList") {
    const items = Array.isArray(node.content) ? node.content : [];
    const Tag = type === "orderedList" ? "ol" : "ul";
    return (
      <Tag>
        {items.map((item, index) => {
          const itemText = nodeText(item);
          return (
            <li key={index} data-added={isAdded(itemText, added) || undefined}>
              {itemText}
            </li>
          );
        })}
      </Tag>
    );
  }
  if (type === "horizontalRule") return <hr />;
  if (!text.trim()) return null;
  return <p data-added={marked || undefined}>{text}</p>;
}

function BlockView({ block }: { block: HistoryBlock }) {
  const t = useTranslations("app");
  if (block.type === "rule") return <span className="vh-rule" />;
  if (block.type === "image") return <span className="vh-kicker">{t("historyImage")}</span>;
  if (block.type === "code") {
    const language = block.language ? LANG[block.language.toLowerCase()] ?? block.language : "";
    return (
      <div className="vh-block">
        <span className="vh-kicker">
          {language ? t("historyCodeLang", { language }) : t("historyCode")}
        </span>
        <code className="vh-code">
          {(block.lines ?? []).map((line, index) => (
            <span key={index} className="vh-line">
              <Spans spans={line} />
            </span>
          ))}
        </code>
      </div>
    );
  }
  if (block.type === "board") return <BoardBlock block={block} />;
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag className="vh-list">
        {(block.items ?? []).map((item, index) => (
          <li key={index}>
            <Spans spans={item} />
          </li>
        ))}
      </Tag>
    );
  }
  if (block.type === "todo") {
    if (block.items?.length) {
      return (
        <div className="vh-todo-list">
          {block.items.map((item, index) => (
            <div className="vh-todo" key={index}>
              <span className="vh-check" data-on={block.checks?.[index] || undefined} />
              <span className="vh-text">
                <Spans spans={item} />
              </span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="vh-todo">
        <span className="vh-check" data-on={block.checked || undefined} />
        <span className="vh-text">
          <Spans spans={block.spans} />
        </span>
      </div>
    );
  }

  const label =
    block.type === "title"
      ? t("historyTitleLabel")
      : block.type === "heading"
        ? t("historyHeading", { level: block.level ?? 1 })
        : block.type === "quote"
          ? t("historyQuote")
          : block.type === "callout"
            ? t("historyCallout")
            : block.type === "embed"
              ? t("historyEmbed")
              : null;
  const aa = block.type === "title" || block.type === "heading";

  return (
    <div className="vh-block">
      {label ? (
        <span className="vh-kicker">
          {aa ? <span className="vh-aa">Aa</span> : null}
          {label}
        </span>
      ) : null}
      <span className="vh-text">
        <Spans spans={block.spans} />
      </span>
    </div>
  );
}

function BoardBlock({ block }: { block: HistoryBlock }) {
  const t = useTranslations("app");
  const count = Math.max(1, block.count ?? 1);
  const many = count > 1;
  if (block.spans?.length) {
    return (
      <div className="vh-block">
        <span className="vh-kicker">{cap(shapeLabel(block.shape ?? "shape", false, t))}</span>
        <span className="vh-text">
          <Spans spans={block.spans} />
        </span>
      </div>
    );
  }
  const countedLabel = shapeCountLabel(block.shape ?? "shape", count, t);
  const singleLabel = shapeLabel(block.shape ?? "shape", false, t);
  const verb = boardActionVerb(block.action ?? "add", block.shape ?? "shape", many, t);
  const line = many ? `${verb} ${count} ${countedLabel}` : `${verb} ${singleLabel}`;
  return <span className="vh-board-line">{line}</span>;
}

function boardActionVerb(
  action: NonNullable<HistoryBlock["action"]>,
  shape: string,
  many: boolean,
  t: ReturnType<typeof useTranslations<"app">>,
) {
  if (many) {
    if (action === "del") return t("historyBoardDelMany");
    if (action === "move") return t("historyBoardMoveMany");
    if (action === "edit") return t("historyBoardEditMany");
    return t("historyBoardAddMany");
  }
  const gender =
    shape === "note" || shape === "geo" || shape === "arrow" || shape === "line" || shape === "frame"
      ? "Feminine"
      : shape === "image"
        ? "Neuter"
        : "Masculine";
  if (action === "del") {
    if (gender === "Feminine") return t("historyBoardDelFeminine");
    if (gender === "Neuter") return t("historyBoardDelNeuter");
    return t("historyBoardDelMasculine");
  }
  if (action === "move") {
    if (gender === "Feminine") return t("historyBoardMoveFeminine");
    if (gender === "Neuter") return t("historyBoardMoveNeuter");
    return t("historyBoardMoveMasculine");
  }
  if (action === "edit") {
    if (gender === "Feminine") return t("historyBoardEditFeminine");
    if (gender === "Neuter") return t("historyBoardEditNeuter");
    return t("historyBoardEditMasculine");
  }
  if (gender === "Feminine") return t("historyBoardAddFeminine");
  if (gender === "Neuter") return t("historyBoardAddNeuter");
  return t("historyBoardAddMasculine");
}

function shapeCountLabel(
  shape: string,
  count: number,
  t: ReturnType<typeof useTranslations<"app">>,
) {
  const key =
    shape === "note"
      ? "historyNoteCount"
      : shape === "text"
        ? "historyTextShapeCount"
        : shape === "geo"
          ? "historyGeoCount"
          : shape === "arrow"
            ? "historyArrowCount"
            : shape === "draw"
              ? "historyDrawCount"
              : shape === "image"
                ? "historyImageShapeCount"
                : shape === "line"
                  ? "historyLineCount"
                  : shape === "frame"
                    ? "historyFrameCount"
                    : "historyShapeCount";
  return t(key, { count });
}

function cap(label: string) {
  return label ? label.slice(0, 1).toLocaleUpperCase() + label.slice(1) : label;
}

function shapeLabel(
  shape: string,
  many: boolean,
  t: ReturnType<typeof useTranslations<"app">>,
) {
  switch (shape) {
    case "note":
      return many ? t("historyNotes") : t("historyNote");
    case "text":
      return many ? t("historyTexts") : t("historyTextShape");
    case "geo":
      return many ? t("historyGeos") : t("historyGeo");
    case "arrow":
      return many ? t("historyArrows") : t("historyArrow");
    case "draw":
      return many ? t("historyDraws") : t("historyDraw");
    case "image":
      return many ? t("historyImages") : t("historyImageShape");
    case "line":
      return many ? t("historyLines") : t("historyLine");
    case "frame":
      return many ? t("historyFrames") : t("historyFrame");
    default:
      return many ? t("historyShapes") : t("historyShape");
  }
}
