"use client";

import { Check, CircleAlert, CloudOff } from "lucide-react";
import { useCallback, useState } from "react";
import { ActivitySpinner } from "./LoadingIndicator";

export type SaveState = "idle" | "saved" | "saving" | "error";

export function useSaveFeedback() {
  const [{ state, revision }, setFeedback] = useState<{ state: SaveState; revision: number }>({ state: "idle", revision: 0 });
  const update = useCallback((next: SaveState) => {
    setFeedback((previous) => next === "saved"
      // Local writes can finish in the same render as "saving".
      ? { state: next, revision: previous.revision + 1 }
      : previous.state === next ? previous : { ...previous, state: next });
  }, []);
  return [state, update, revision] as const;
}

type SaveMessageProps = {
  state: Exclude<SaveState, "idle"> | "offline";
  label: string;
  description?: string;
};

export function SaveIndicator({ state, revision, ...props }: Omit<SaveMessageProps, "state"> & {
  state: SaveState | "offline";
  revision: number;
}) {
  if (state === "idle") return null;
  return <SaveMessage key={state === "saved" ? revision : state} state={state} {...props} />;
}

function SaveMessage({ state, label, description }: SaveMessageProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const Icon = state === "saved" ? Check : state === "offline" ? CloudOff : CircleAlert;
  return (
    <span
      className="relay-save-indicator"
      data-state={state}
      data-tooltip={description}
      role="status"
      onAnimationEnd={(event) => {
        if (state === "saved" && event.target === event.currentTarget) setDismissed(true);
      }}
    >
      {state === "saving" ? <ActivitySpinner /> : <Icon aria-hidden />}
      <span>{label}</span>
    </span>
  );
}
