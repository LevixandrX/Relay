import { SaveIndicator, type SaveState } from "@relay-ui/SaveIndicator";
import { useTranslations } from "use-intl";
import { useWorkspace } from "../lib/workspace";

export function WorkspacePresence({ save, revision }: { save: SaveState; revision: number }) {
  const t = useTranslations("desktop");
  const { mode, offline } = useWorkspace();
  const local = mode !== "cloud" || offline;

  if (save === "saving") {
    return <SaveIndicator state={save} revision={revision} label={t("statusSaving")} />;
  }
  if (save === "error") {
    return <SaveIndicator state={save} revision={revision} label={t("presenceError")} description={t("presenceErrorHint")} />;
  }
  if (mode === "cloud" && offline) {
    return <SaveIndicator state="offline" revision={revision} label={t("presenceOffline")} description={t("presenceOfflineHint")} />;
  }
  return <SaveIndicator state={save} revision={revision} label={t("presenceSaved")} description={t(local ? "presenceLocalHint" : "presenceCloudHint")} />;
}
