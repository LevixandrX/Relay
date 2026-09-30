"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import { subscribeActivityChanged } from "../lib/activity-refresh";
import { ActivityPanel, type AnalyticsRange, type AnalyticsReport } from "./ActivityPanel";

export type { AnalyticsRange, AnalyticsReport };
import type { RevisionSummary } from "./VersionHistory";

const OPEN_KEY = "relay.activity.open";
const OPEN_PAGE = "relay:open-page";
const OPEN_BOARD = "relay:open-board";

export function readActivityOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeActivityOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export type ActivityItem = {
  id: string | number;
  action: string;
  actorName: string | null;
  createdAt?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  meta?: { title?: string; email?: string; name?: string } | null;
};

function useRelativeTime() {
  const t = useTranslations("app");
  return (iso?: string | null) => {
    if (!iso) return "";
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return "";
    const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (minutes < 1) return t("relativeJustNow");
    if (minutes < 60) return t("relativeMinutes", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("relativeHours", { count: hours });
    return t("relativeDays", { count: Math.round(hours / 24) });
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function dayBucket(iso?: string | null) {
  if (!iso) return "earlier";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "earlier";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((start.getTime() - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return "earlier";
}

function targetLabel(ev: ActivityItem, boardLabel: string) {
  if (ev.action === "board.update") return ev.meta?.title || boardLabel;
  return ev.meta?.title || ev.meta?.email || ev.meta?.name || "";
}

function canOpen(ev: ActivityItem) {
  return (ev.targetType === "page" && Boolean(ev.targetId)) || ev.action === "board.update";
}

function openItem(ev: ActivityItem) {
  if (ev.targetType === "page" && ev.targetId) {
    window.dispatchEvent(new CustomEvent(OPEN_PAGE, { detail: ev.targetId }));
    return;
  }
  if (ev.action === "board.update") {
    window.dispatchEvent(new CustomEvent(OPEN_BOARD));
  }
}

export function ActivityDisclosure({
  items,
  unread,
  labelAction,
  onOpen,
  max = 8,
  variant = "sidebar",
  scopeTitle = "",
  viewerId,
  seenId,
  onSeen,
  refreshKey = "",
  listUpdates,
  listAnalytics,
  onViewVersion,
}: {
  items: ActivityItem[];
  unread: boolean;
  labelAction: (action: string) => string;
  onOpen?: () => void;
  max?: number;
  variant?: "sidebar" | "chrome";
  scopeTitle?: string;
  viewerId?: string | null;
  seenId?: string | null;
  onSeen?: (id: string) => void;
  refreshKey?: string;
  listUpdates?: () => Promise<RevisionSummary[]>;
  listAnalytics?: (range: AnalyticsRange) => Promise<AnalyticsReport>;
  onViewVersion?: (row: RevisionSummary) => void;
}) {
  const t = useTranslations("app");
  const tc = useTranslations("common");
  const relative = useRelativeTime();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const [hover, setHover] = useState(false);
  const [hoverPos, setHoverPos] = useState({ top: -999, right: 8 });
  const [hoverMount, setHoverMount] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const hoverHide = useRef<number | null>(null);
  const overChrome = useRef(false);
  const ignoreHoverUntil = useRef(0);
  const listUpdatesRef = useRef(listUpdates);
  listUpdatesRef.current = listUpdates;
  const [updates, setUpdates] = useState<RevisionSummary[]>([]);
  const [updatesLoaded, setUpdatesLoaded] = useState(false);
  const [tab, setTab] = useState<"updates" | "analytics">("updates");
  const [activityRevision, setActivityRevision] = useState(0);
  const [, setRelativeRevision] = useState(0);

  useEffect(() => subscribeActivityChanged(() => setActivityRevision((value) => value + 1)), []);

  useEffect(() => {
    const timer = window.setInterval(() => setRelativeRevision((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (variant !== "chrome" || !listUpdatesRef.current) return;
    let cancelled = false;
    setUpdatesLoaded(false);
    void listUpdatesRef.current()
      .then((rows) => {
        if (!cancelled) setUpdates(rows.filter((row) => !row.baseline));
      })
      .catch(() => {
        if (!cancelled) setUpdates([]);
      })
      .finally(() => {
        if (!cancelled) setUpdatesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [variant, refreshKey, activityRevision]);

  useEffect(() => {
    if (variant === "chrome") return;
    setOpen(readActivityOpen());
  }, [variant]);

  useEffect(() => {
    if (variant === "chrome") setHoverMount(true);
  }, [variant]);

  useEffect(() => {
    return () => {
      if (hoverHide.current) window.clearTimeout(hoverHide.current);
    };
  }, []);

  const closePanel = useCallback(() => {
    setPanel(false);
    setHover(false);
    ignoreHoverUntil.current = Date.now() + 280;
    const el = triggerRef.current;
    if (el) {
      el.blur();
      if (document.activeElement === el) el.blur();
    }
  }, []);

  const placeHover = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHoverPos({ top: r.bottom + 8, right: 8 });
  }, []);

  const showHover = useCallback(() => {
    if (panel || Date.now() < ignoreHoverUntil.current) return;
    if (hoverHide.current) window.clearTimeout(hoverHide.current);
    hoverHide.current = null;
    placeHover();
    setHover(true);
  }, [panel, placeHover]);

  const hideHover = useCallback(() => {
    if (hoverHide.current) window.clearTimeout(hoverHide.current);
    hoverHide.current = window.setTimeout(() => {
      const trigger = triggerRef.current;
      const pop = hoverRef.current;
      if (overChrome.current) return;
      if (trigger?.matches(":hover") || pop?.matches(":hover")) return;
      setHover(false);
    }, 220);
  }, []);

  useEffect(() => {
    if (!panel) return;
    function onDown(e: PointerEvent) {
      const node = e.target as Node;
      if (rootRef.current?.contains(node) || panelRef.current?.contains(node)) return;
      closePanel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    }
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [panel, closePanel]);

  function compactList(limit = max) {
    if (items.length === 0) {
      return <p className="relay-activity-empty">{t("pulseEmpty")}</p>;
    }
    return (
      <ul>
        {items.slice(0, limit).map((ev) => {
          const who = ev.actorName ?? tc("someone");
          const what = labelAction(ev.action);
          const extra = targetLabel(ev, t("board"));
          return (
            <li key={ev.id}>
              <span className="relay-activity-text" title={`${who} ${what}${extra ? ` · ${extra}` : ""}`}>
                <strong>{who}</strong> {what}
                {extra ? <span> · {extra}</span> : null}
              </span>
              <span className="relay-activity-time">{relative(ev.createdAt)}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  function groupedPanel() {
    if (items.length === 0) {
      return (
        <div className="relay-activity-empty-panel">
          <p className="relay-activity-empty">{t("pulseEmpty")}</p>
          <p className="relay-activity-empty-hint">{t("pulseHint")}</p>
        </div>
      );
    }
    const groups: { key: "today" | "yesterday" | "earlier"; items: ActivityItem[] }[] = [
      { key: "today", items: [] },
      { key: "yesterday", items: [] },
      { key: "earlier", items: [] },
    ];
    for (const ev of items.slice(0, 40)) {
      const bucket = dayBucket(ev.createdAt);
      groups.find((g) => g.key === bucket)?.items.push(ev);
    }
    const labels = {
      today: t("pulseToday"),
      yesterday: t("pulseYesterday"),
      earlier: t("pulseEarlier"),
    };
    return (
      <>
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.key} className="relay-activity-chunk">
              <div className="relay-activity-group">{labels[group.key]}</div>
              {group.items.map((ev) => {
                const who = ev.actorName ?? tc("someone");
                const what = labelAction(ev.action);
                const extra = targetLabel(ev, t("board"));
                const clickable = canOpen(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="relay-activity-row"
                    data-static={clickable ? undefined : true}
                    onClick={() => {
                      if (!clickable) return;
                      openItem(ev);
                      closePanel();
                    }}
                  >
                    <span className="relay-activity-avatar" aria-hidden>
                      {initials(who)}
                    </span>
                    <span className="relay-activity-copy">
                      <span className="relay-activity-lead">
                        <strong>{who}</strong> {what}
                      </span>
                      {extra ? <span className="relay-activity-target">{extra}</span> : null}
                    </span>
                    <span className="relay-activity-time">{relative(ev.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          ),
        )}
      </>
    );
  }

  if (variant === "chrome") {
    const latestUpdate = updates[0];
    const latest = items[0];
    const updateUnread = Boolean(latestUpdate && latestUpdate.id !== seenId);
    const trigger = latestUpdate
      ? `${t("activityEditedShort")} ${relative(latestUpdate.createdAt)}`
      : latest
        ? `${labelAction(latest.action)} ${relative(latest.createdAt)}`
        : t("pulse");
    const dot = listUpdates ? updateUnread : unread;

    return (
      <div
        className="relay-activity-chrome"
        ref={rootRef}
        data-panel={panel || undefined}
        onPointerEnter={() => {
          overChrome.current = true;
          showHover();
        }}
        onPointerMove={() => {
          overChrome.current = true;
          showHover();
        }}
        onPointerLeave={() => {
          overChrome.current = false;
          hideHover();
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          className="relay-activity-trigger"
          data-unread={dot || undefined}
          aria-expanded={panel}
          onPointerDown={(e) => {
            if (!panel) return;
            e.preventDefault();
            e.stopPropagation();
            closePanel();
          }}
          onClick={() => {
            if (panel) return;
            ignoreHoverUntil.current = Date.now() + 280;
            setPanel(true);
            setHover(false);
            onOpen?.();
            if (latestUpdate) onSeen?.(latestUpdate.id);
          }}
        >
          {trigger}
        </button>
        {hoverMount
          ? createPortal(
              <div
                ref={hoverRef}
                className="relay-activity-hover"
                data-open={hover && !panel ? "true" : undefined}
                role="dialog"
                aria-hidden={hover && !panel ? undefined : true}
                aria-label={t("pulse")}
                style={{ top: hoverPos.top, right: hoverPos.right }}
                onPointerEnter={() => {
                  overChrome.current = true;
                  showHover();
                }}
                onPointerLeave={() => {
                  overChrome.current = false;
                  hideHover();
                }}
              >
                <div className="relay-activity-hover-head">{t("pulse")}</div>
                {updates.length > 0 ? (
                  <ul>
                    {updates.slice(0, 5).map((row) => (
                      <li key={row.id}>
                        <span className="relay-activity-text">
                          <strong>{row.createdByName || tc("someone")}</strong> {row.title || scopeTitle}
                        </span>
                        <span className="relay-activity-time">{relative(row.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  compactList(5)
                )}
              </div>,
              document.body,
            )
          : null}
        {panel
          ? createPortal(
              <>
                <div
                  className="relay-activity-scrim"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    closePanel();
                  }}
                />
                <div
                  ref={panelRef}
                  className="relay-activity-panel"
                  role="dialog"
                  aria-label={t("pulse")}
                >
                  <div className="relay-activity-panel-head">
                    <strong>{t("pulse")}</strong>
                    <button
                      type="button"
                      className="relay-activity-panel-close"
                      onClick={closePanel}
                      aria-label={t("close")}
                    >
                      ×
                    </button>
                  </div>
                  <OverlayScroll contentClassName="relay-activity-panel-body">
                    {listUpdates && listAnalytics && onViewVersion ? (
                      <ActivityPanel
                        tab={tab}
                        onTab={setTab}
                        updates={updates}
                        loaded={updatesLoaded}
                        scopeTitle={scopeTitle}
                        viewerId={viewerId}
                        onViewVersion={(row) => {
                          closePanel();
                          onViewVersion(row);
                        }}
                        listAnalytics={listAnalytics}
                      />
                    ) : (
                      groupedPanel()
                    )}
                  </OverlayScroll>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <details
      className="relay-activity"
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        setOpen(next);
        writeActivityOpen(next);
        if (next) onOpen?.();
      }}
    >
      <summary>
        <span className="relay-activity-caret" aria-hidden />
        <span>{t("pulse")}</span>
        {unread ? <span className="relay-activity-dot" aria-hidden /> : null}
      </summary>
      {compactList()}
    </details>
  );
}
