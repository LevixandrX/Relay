import { useState } from "react";
import { useTranslations } from "use-intl";
import { ActivityDisclosure, type AnalyticsReport } from "@relay-activity";
import { VersionHistory, type HistoryClient, type RevisionSummary } from "@relay-history";
import { InfiniteBoard } from "../board/InfiniteBoard";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { readPulseSeen, writePulseSeen } from "@relay-board/pulse-seen";
import { labelPulseAction } from "../lib/useWorkspacePulse";
import type { BoardSnapshot } from "../lib/types";
import { focusFromRevision, stageActivityFocus } from "@relay-board/activity-focus";

export function ActivityStrip({ pageId }: { pageId?: string | null }) {
  const t = useTranslations("app");
  const auth = useAuth();
  const { mode, activeWorkspaceId, activeRole } = useWorkspace();
  const [seenId, setSeenId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ pageId: string | null; entryId: string } | null>(null);

  if (mode !== "cloud" || !auth.token || !activeWorkspaceId) return null;
  const token = auth.token;
  const workspaceId = activeWorkspaceId;

  return (
    <>
      <ActivityDisclosure
        variant="chrome"
        items={[]}
        unread={false}
        labelAction={(action) => labelPulseAction(action, t)}
        scopeTitle={pageId ? "" : t("infiniteBoard")}
        viewerId={auth.user?.id}
        seenId={seenId ?? readPulseSeen(workspaceId)}
        onSeen={(id) => {
          writePulseSeen(workspaceId, id);
          setSeenId(id);
        }}
        refreshKey={`${workspaceId}:${pageId ?? "board"}`}
        listUpdates={async () => {
          const path = pageId
            ? `/pages/${pageId}/revisions`
            : `/workspaces/${workspaceId}/activity`;
          const data = await api<{ revisions: RevisionSummary[] }>(path, { token });
          return data.revisions ?? [];
        }}
        listAnalytics={async (range) => {
          const q = new URLSearchParams({ range });
          if (pageId) q.set("pageId", pageId);
          return api<AnalyticsReport>(`/workspaces/${workspaceId}/analytics?${q}`, { token });
        }}
        onViewVersion={(row) => {
          setHistory({
            pageId: row.scope === "board" ? null : (row.pageId ?? pageId ?? null),
            entryId: row.id,
          });
        }}
        onOpenUpdate={(row, block) => {
          const focus = focusFromRevision(row, block);
          if (row.scope !== "board" && !focus.pageId) focus.pageId = pageId ?? null;
          stageActivityFocus(focus);
          if (focus.pageId) {
            window.dispatchEvent(new CustomEvent("relay:open-page", { detail: focus.pageId }));
          } else {
            window.dispatchEvent(new CustomEvent("relay:open-board"));
          }
        }}
      />
      <VersionHistory
        open={history !== null}
        title={history?.pageId ? "" : t("infiniteBoard")}
        canRestore={activeRole !== "viewer"}
        initialId={history?.entryId}
        client={historyClient(workspaceId, history?.pageId ?? null, token)}
        loadCurrent={() => loadCurrent(workspaceId, history?.pageId ?? null, token)}
        renderBoard={(board) => (
          <InfiniteBoard
            key={history?.entryId ?? "history-board"}
            initialSnapshot={board as BoardSnapshot}
            editable={false}
          />
        )}
        onClose={() => setHistory(null)}
        onRestored={() => {
          const restored = history?.pageId ?? null;
          setHistory(null);
          window.dispatchEvent(
            new CustomEvent("relay:history-restored", { detail: { pageId: restored } }),
          );
        }}
      />
    </>
  );
}

function historyClient(workspaceId: string, pageId: string | null, token: string): HistoryClient {
  if (!pageId) {
    return {
      list: () => api(`/workspaces/${workspaceId}/board/revisions`, { token }),
      get: (id) => api(`/workspaces/${workspaceId}/board/revisions/${id}`, { token }),
      restore: async (id) => {
        await api(`/workspaces/${workspaceId}/board/revisions/${id}/restore`, {
          method: "POST",
          token,
        });
      },
    };
  }
  return {
    list: () => api(`/pages/${pageId}/revisions`, { token }),
    get: (id) => api(`/pages/${pageId}/revisions/${id}`, { token }),
    restore: async (id) => {
      await api(`/pages/${pageId}/revisions/${id}/restore`, { method: "POST", token });
    },
  };
}

async function loadCurrent(workspaceId: string, pageId: string | null, token: string) {
  if (!pageId) {
    const data = await api<{ board: unknown }>(`/workspaces/${workspaceId}/board`, { token });
    return { title: "", content: null, board: data.board ?? null };
  }
  const data = await api<{ title: string; content: unknown; board: unknown }>(`/pages/${pageId}`, {
    token,
  });
  return { title: data.title ?? "", content: data.content ?? null, board: data.board ?? null };
}
