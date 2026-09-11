import { useTranslations } from "use-intl";
import { useWorkspace } from "../lib/workspace";

export type PresenceSave = "saved" | "saving" | "error" | "loading";

type Props = {
  save?: PresenceSave;
};

function CloudOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.4 7.6A5 5 0 0 1 17 10.2 3.6 3.6 0 0 1 19.2 17M5.2 9.4A4.2 4.2 0 0 0 4 13.4 3.6 3.6 0 0 0 7.6 17h8.1M4 4l16 16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.2 17.5h9.3A3.6 3.6 0 0 0 17 10.4 5 5 0 0 0 7.5 8.2 4.2 4.2 0 0 0 4 13.5 3.6 3.6 0 0 0 7.2 17.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Quiet toolbar presence: where the file lives + whether the last edit stuck.
 * Icon = place (cloud vs this PC). Label = save/offline. Not a badge.
 */
export function WorkspacePresence({ save = "saved" }: Props) {
  const t = useTranslations("desktop");
  const { mode, offline } = useWorkspace();
  const local = mode !== "cloud" || offline;

  if (save === "loading") return null;

  let label = t("presenceSaved");
  let hint = local ? t("presenceLocalHint") : t("presenceCloudHint");

  if (save === "saving") {
    label = t("statusSaving");
  } else if (save === "error") {
    label = t("presenceError");
    hint = t("presenceErrorHint");
  } else if (offline) {
    label = t("presenceOfflineHere");
    hint = t("presenceOfflineHint");
  } else if (local) {
    label = t("presenceSavedHere");
  }

  return (
    <span
      className="presence"
      title={hint}
      data-kind={local ? "local" : "cloud"}
      data-tone={save === "error" ? "danger" : undefined}
    >
      <span className="presence-ico">{local ? <CloudOffIcon /> : <CloudIcon />}</span>
      <span className="presence-label">{label}</span>
    </span>
  );
}
