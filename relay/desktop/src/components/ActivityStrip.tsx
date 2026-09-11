import { useTranslations } from "use-intl";
import { ActivityDisclosure } from "@relay-activity";
import { labelPulseAction, useWorkspacePulse } from "../lib/useWorkspacePulse";

export function ActivityStrip({ pageId }: { pageId?: string | null }) {
  const t = useTranslations("app");
  const { pulse, isCloud, unread, markSeen } = useWorkspacePulse(pageId);

  if (!isCloud) return null;

  return (
    <ActivityDisclosure
      variant="chrome"
      items={pulse}
      unread={unread}
      labelAction={(action) => labelPulseAction(action, t)}
      onOpen={markSeen}
    />
  );
}
