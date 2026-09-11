import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import {
  readPulseSeen,
  subscribePulseSeen,
  writePulseSeen,
} from "@relay-board/pulse-seen";

export type PulseEvent = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  meta?: { title?: string; email?: string; name?: string } | null;
};

export function useWorkspacePulse(pageId?: string | null) {
  const auth = useAuth();
  const ws = useWorkspace();
  const [pulse, setPulse] = useState<PulseEvent[]>([]);
  const [seenId, setSeenId] = useState<string | null>(null);
  const workspaceId = ws.activeWorkspaceId;

  useEffect(() => {
    if (ws.mode !== "cloud" || !auth.token || !workspaceId) {
      setPulse([]);
      return;
    }
    let cancelled = false;
    const q = pageId ? `?pageId=${encodeURIComponent(pageId)}` : "";
    void (async () => {
      try {
        const data = await api<{ events: PulseEvent[] }>(
          `/workspaces/${workspaceId}/pulse${q}`,
          { token: auth.token },
        );
        if (!cancelled) setPulse(data.events ?? []);
      } catch {
        if (!cancelled) setPulse([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ws.mode, auth.token, workspaceId, pageId]);

  useEffect(() => {
    if (!workspaceId) {
      setSeenId(null);
      return;
    }
    const sync = () => setSeenId(readPulseSeen(workspaceId));
    sync();
    return subscribePulseSeen(sync);
  }, [workspaceId]);

  const latestId = pulse[0] ? String(pulse[0].id) : null;
  const unread = Boolean(ws.mode === "cloud" && latestId && latestId !== seenId);

  const markSeen = useCallback(() => {
    if (!workspaceId || !latestId) return;
    writePulseSeen(workspaceId, latestId);
    setSeenId(latestId);
  }, [workspaceId, latestId]);

  return { pulse, isCloud: ws.mode === "cloud", unread, markSeen };
}

export function labelPulseAction(action: string, ta: (key: string) => string) {
  const map: Record<string, string> = {
    "page.create": ta("actionPageCreate"),
    "page.update": ta("actionPageUpdate"),
    "page.publish": ta("actionPagePublish"),
    "page.prompt": ta("actionPagePrompt"),
    "page.restore": ta("actionPageRestore"),
    "member.invite": ta("actionMemberInvite"),
    "workspace.create": ta("actionWorkspaceCreate"),
    "board.update": ta("actionBoardUpdate"),
    "board.restore": ta("actionBoardRestore"),
  };
  return map[action] ?? action;
}
