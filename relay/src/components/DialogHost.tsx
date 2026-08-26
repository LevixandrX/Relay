"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

type ConfirmOpts = {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
};

type PromptOpts = {
  title: string;
  body?: string;
  defaultValue?: string;
  confirmLabel?: string;
};

type AlertOpts = {
  title: string;
  body?: string;
};

type DialogApi = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
  alert: (opts: AlertOpts) => Promise<void>;
};

type DialogState =
  | (ConfirmOpts & { kind: "confirm"; resolve: (v: boolean) => void })
  | (PromptOpts & { kind: "prompt"; value: string; resolve: (v: string | null) => void })
  | (AlertOpts & { kind: "alert"; resolve: () => void });

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog needs DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const tc = useTranslations("common");
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opts) =>
        new Promise((resolve) => setDialog({ kind: "confirm", ...opts, resolve })),
      prompt: (opts) =>
        new Promise((resolve) =>
          setDialog({ kind: "prompt", ...opts, value: opts.defaultValue ?? "", resolve }),
        ),
      alert: (opts) =>
        new Promise((resolve) => setDialog({ kind: "alert", ...opts, resolve })),
    }),
    [],
  );

  const close = useCallback(() => setDialog(null), []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && (
        <div
          className="relay-modal-backdrop"
          onClick={() => {
            if (dialog.kind === "confirm") dialog.resolve(false);
            else if (dialog.kind === "prompt") dialog.resolve(null);
            else dialog.resolve();
            close();
          }}
        >
          <div
            className="relay-modal relay-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="relay-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="relay-dialog-title">{dialog.title}</h2>
            {dialog.body && <p className="relay-modal-lede">{dialog.body}</p>}
            {dialog.kind === "prompt" && (
              <input
                className="relay-input"
                autoFocus
                value={dialog.value}
                onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = dialog.value.trim();
                    dialog.resolve(v || null);
                    close();
                  }
                }}
              />
            )}
            <div className="relay-dialog-actions">
              {dialog.kind !== "alert" && (
                <button
                  type="button"
                  className="relay-btn"
                  onClick={() => {
                    if (dialog.kind === "confirm") dialog.resolve(false);
                    else dialog.resolve(null);
                    close();
                  }}
                >
                  {tc("cancel")}
                </button>
              )}
              <button
                type="button"
                className={
                  dialog.kind === "confirm" && dialog.danger
                    ? "relay-btn relay-btn-danger"
                    : "relay-btn relay-btn-accent"
                }
                autoFocus={dialog.kind !== "prompt"}
                onClick={() => {
                  if (dialog.kind === "confirm") dialog.resolve(true);
                  else if (dialog.kind === "prompt") {
                    const v = dialog.value.trim();
                    dialog.resolve(v || null);
                  } else dialog.resolve();
                  close();
                }}
              >
                {dialog.kind === "confirm"
                  ? (dialog.confirmLabel ?? tc("confirm"))
                  : dialog.kind === "prompt"
                    ? (dialog.confirmLabel ?? tc("confirm"))
                    : tc("done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
