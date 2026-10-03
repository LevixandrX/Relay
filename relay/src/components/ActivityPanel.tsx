"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { UpdateCard, type HistoryBlock, type RevisionSummary } from "./VersionHistory";

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

export type AnalyticsReport = {
  range: AnalyticsRange;
  totalViews: number;
  buckets: { start: string; views: number; edits: number }[];
  viewers: { name: string; avatarUrl: string | null; seenAt: string }[];
  createdBy: { name: string; avatarUrl: string | null; at: string } | null;
  editors: { name: string; avatarUrl: string | null; at: string }[];
};

export function ActivityPanel({
  tab,
  onTab,
  updates,
  loaded,
  scopeTitle,
  viewerId,
  onViewVersion,
  onOpenUpdate,
  listAnalytics,
}: {
  tab: "updates" | "analytics";
  onTab: (tab: "updates" | "analytics") => void;
  updates: RevisionSummary[];
  loaded: boolean;
  scopeTitle: string;
  viewerId?: string | null;
  onViewVersion: (row: RevisionSummary) => void;
  onOpenUpdate: (row: RevisionSummary, block: HistoryBlock) => void;
  listAnalytics: (range: AnalyticsRange) => Promise<AnalyticsReport>;
}) {
  const t = useTranslations("app");
  return (
    <>
      <div className="activity-tabs" role="tablist">
        <button
          type="button"
          className="activity-tab"
          data-active={tab === "updates" || undefined}
          onClick={() => onTab("updates")}
        >
          {t("activityUpdates")}
        </button>
        <button
          type="button"
          className="activity-tab"
          data-active={tab === "analytics" || undefined}
          onClick={() => onTab("analytics")}
        >
          {t("activityAnalytics")}
        </button>
      </div>
      {tab === "updates" ? (
        <div className="activity-updates">
          {loaded && updates.length === 0 ? (
            <p className="relay-activity-empty">{t("activityNoUpdates")}</p>
          ) : null}
          {updates.map((row) => (
            <UpdateCard
              key={row.id}
              row={row}
              title={row.scope === "board" ? scopeTitle : row.title || scopeTitle}
              viewerId={viewerId}
              onViewVersion={onViewVersion}
              onOpen={onOpenUpdate}
            />
          ))}
        </div>
      ) : (
        <Analytics listAnalytics={listAnalytics} />
      )}
    </>
  );
}

function Analytics({ listAnalytics }: { listAnalytics: (range: AnalyticsRange) => Promise<AnalyticsReport> }) {
  const t = useTranslations("app");
  const locale = useLocale();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const loadRef = useRef(listAnalytics);
  loadRef.current = listAnalytics;

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    void loadRef.current(range)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const relative = (iso?: string | null) => {
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

  return (
    <div>
      <div className="activity-chart-wrap">
        <div className="activity-chart-head">
          <strong>{t("activityViewsTitle", { count: report?.totalViews ?? 0 })}</strong>
          <select
            aria-label={t("activityRange")}
            value={range}
            onChange={(e) => setRange(e.target.value as AnalyticsRange)}
          >
            <option value="7d">{t("activityRange7")}</option>
            <option value="30d">{t("activityRange30")}</option>
            <option value="90d">{t("activityRange90")}</option>
            <option value="all">{t("activityRangeAll")}</option>
          </select>
        </div>
        <ActivityChart buckets={report?.buckets ?? []} />
        <div className="activity-legend">
          <span>
            <i style={{ background: "var(--accent)" }} />
            {t("activityViews")}
          </span>
          <span>
            <i style={{ background: "var(--warn, #c4a574)" }} />
            {t("activityEdits")}
          </span>
        </div>
      </div>
      <section className="activity-section">
        <h3>{t("activityViewers")}</h3>
        {report && report.viewers.length === 0 ? (
          <p className="relay-activity-empty">{t("activityNoViewers")}</p>
        ) : null}
        {report?.viewers.map((person) => (
          <Person
            key={person.seenAt + person.name}
            name={person.name || t("historySomeone")}
            url={person.avatarUrl}
            when={relative(person.seenAt)}
          />
        ))}
      </section>
      <section className="activity-section">
        <h3>{t("activityEditors")}</h3>
        {report?.createdBy ? (
          <>
            <p className="activity-kicker">{t("activityCreatedBy")}</p>
            <Person
              name={report.createdBy.name}
              url={report.createdBy.avatarUrl}
              when={new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
                new Date(report.createdBy.at),
              )}
            />
          </>
        ) : null}
        {report && report.editors.length > 0 ? (
          <p className="activity-kicker">{t("activityRecentEditors")}</p>
        ) : null}
        {report?.editors.map((person) => (
          <Person
            key={person.at + person.name}
            name={person.name || t("historySomeone")}
            url={person.avatarUrl}
            when={relative(person.at)}
          />
        ))}
      </section>
    </div>
  );
}

function Person({ name, url, when }: { name: string; url?: string | null; when: string }) {
  const letter = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div className="activity-person">
      {url ? <img className="vh-avatar" src={url} alt="" /> : <span className="vh-avatar">{letter}</span>}
      <span>{name}</span>
      <span>{when}</span>
    </div>
  );
}

function ActivityChart({ buckets }: { buckets: { start: string; views: number; edits: number }[] }) {
  if (buckets.length === 0) return null;
  const width = 320;
  const height = 112;
  const max = Math.max(1, ...buckets.flatMap((bucket) => [bucket.views, bucket.edits]));
  const x = (index: number) => (buckets.length === 1 ? width / 2 : (index / (buckets.length - 1)) * width);
  const y = (value: number) => height - (value / max) * (height - 10) - 2;
  const line = (key: "views" | "edits") =>
    buckets.map((bucket, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(bucket[key]).toFixed(1)}`).join(" ");
  const area = (key: "views" | "edits") =>
    `${line(key)} L${x(buckets.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const labels = [buckets[0], buckets[Math.floor(buckets.length / 2)], buckets[buckets.length - 1]].filter(
    (bucket, index, all) => all.findIndex((item) => item.start === bucket.start) === index,
  );
  return (
    <>
      <svg className="activity-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <path d={area("edits")} fill="color-mix(in oklab, var(--warn, #c4a574) 45%, transparent)" />
        <path d={area("views")} fill="color-mix(in oklab, var(--accent) 35%, transparent)" />
        <path d={line("edits")} fill="none" stroke="var(--warn, #c4a574)" strokeWidth="1.6" />
        <path d={line("views")} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      </svg>
      <div className="activity-legend">
        {labels.map((bucket) => (
          <span key={bucket.start}>{bucket.start.slice(5)}</span>
        ))}
      </div>
    </>
  );
}
