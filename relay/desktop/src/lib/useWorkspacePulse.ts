import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";

export type PulseEvent = {
  id: string;
  action: string;
  actorName: string | null;
};

export function useWorkspacePulse() {
  const auth = useAuth();
  const ws = useWorkspace();
  const [pulse, setPulse] = useState<PulseEvent[]>([]);

  useEffect(() => {
    if (ws.mode !== "cloud" || !auth.token || !ws.activeWorkspaceId) {
      setPulse([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ events: PulseEvent[] }>(
          `/workspaces/${ws.activeWorkspaceId}/pulse`,
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
  }, [ws.mode, auth.token, ws.activeWorkspaceId]);

  return { pulse, isCloud: ws.mode === "cloud" };
}

export function labelPulseAction(action: string, ta: (key: string) => string) {
  const map: Record<string, string> = {
    "page.create": ta("actionPageCreate"),
    "page.update": ta("actionPageUpdate"),
    "page.publish": ta("actionPagePublish"),
    "page.prompt": ta("actionPagePrompt"),
    "member.invite": ta("actionMemberInvite"),
    "workspace.create": ta("actionWorkspaceCreate"),
    "board.update": ta("actionBoardUpdate"),
  };
  return map[action] ?? action;
}
