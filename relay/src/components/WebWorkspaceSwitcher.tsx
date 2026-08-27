"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  workspaceAccent,
  workspaceDisplayName,
  isWorkspaceRenameUnchanged,
  workspaceInitialsFromLabel,
} from "@/domain/workspaces/naming";
import { useDialog } from "@/components/DialogHost";

export type WebWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
  ownerName?: string | null;
};

function roleKey(role: string) {
  if (role === "owner") return "roleOwner" as const;
  if (role === "editor") return "roleEditor" as const;
  return "roleViewer" as const;
}

export function WebWorkspaceSwitcher({
  workspaceId,
  workspaceName,
  ownerName,
  collapsed,
  onExpand,
  onInvite,
}: {
  workspaceId: string;
  workspaceName: string;
  ownerName?: string | null;
  collapsed?: boolean;
  onExpand?: () => void;
  onInvite?: () => void;
}) {
  const t = useTranslations("app");
  const router = useRouter();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workspaces, setWorkspaces] = useState<WebWorkspace[]>([
    {
      id: workspaceId,
      name: workspaceName,
      slug: "",
      role: "owner",
      memberCount: 1,
      ownerName,
    },
  ]);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/workspaces", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { workspaces: WebWorkspace[] };
        if (!cancelled && data.workspaces?.length) setWorkspaces(data.workspaces);
      } catch {
        /* keep seed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = workspaces.find((w) => w.id === workspaceId) ?? {
    id: workspaceId,
    name: workspaceName,
    slug: "",
    role: "owner",
    memberCount: 1,
    ownerName,
  };
  const label = labelOf(active, t);
  const sub = metaLine(active, t);
  const mark = workspaceInitialsFromLabel(active.name, active.ownerName);

  if (collapsed) {
    return (
      <button
        type="button"
        className="relay-ws-mark-btn"
        title={`${label} · ${sub}`}
        aria-label={label}
        onClick={() => onExpand?.()}
      >
        <span className="relay-ws-mark" style={{ background: workspaceAccent(active.id) }} aria-hidden>
          {mark}
        </span>
      </button>
    );
  }

  async function createWorkspace() {
    if (busy) return;
    const name = (
      await dialog.prompt({
        title: t("createWorkspacePrompt"),
        defaultValue: t("newWorkspaceDefault"),
        confirmLabel: t("createWorkspace"),
      })
    )?.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/workspaces", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { id?: string; message?: string };
      if (!res.ok || !data.id) {
        await dialog.alert({ title: data.message || t("createWorkspaceFailed") });
        return;
      }
      setOpen(false);
      router.push(`/w/${data.id}/board`);
    } catch {
      await dialog.alert({ title: t("createWorkspaceFailed") });
    } finally {
      setBusy(false);
    }
  }

  async function renameActive() {
    if (busy || active.role !== "owner") return;
    const next = (
      await dialog.prompt({
        title: t("renameWorkspacePrompt"),
        defaultValue: label,
        confirmLabel: t("renameWorkspace"),
      })
    )?.trim();
    if (!next || isWorkspaceRenameUnchanged(next, active.name, label)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${active.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) {
        await dialog.alert({ title: t("renameWorkspaceFailed") });
        return;
      }
      setWorkspaces((prev) => prev.map((w) => (w.id === active.id ? { ...w, name: next } : w)));
      setOpen(false);
      router.refresh();
    } catch {
      await dialog.alert({ title: t("renameWorkspaceFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relay-ws-switch" ref={rootRef}>
      <button
        type="button"
        className="relay-ws-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relay-ws-mark" style={{ background: workspaceAccent(active.id) }} aria-hidden>
          {mark}
        </span>
        <span className="relay-ws-copy">
          <span className="relay-ws-name">{label}</span>
          <span className="relay-ws-meta">{sub}</span>
        </span>
        <span className="relay-ws-chevron" data-open={open || undefined} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5 6 7.5 9 4.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div className="relay-ws-menu" id={listId} role="listbox" aria-label={t("workspaceSwitcherLabel")}>
          <div className="relay-ws-menu-label">{t("workspaceSwitcherLabel")}</div>
          {workspaces.map((w) => {
            const selected = w.id === active.id;
            const name = labelOf(w, t);
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={selected}
                className="relay-ws-menu-item"
                data-active={selected}
                onClick={() => {
                  setOpen(false);
                  if (w.id !== workspaceId) router.push(`/w/${w.id}/board`);
                }}
              >
                <span className="relay-ws-mark" style={{ background: workspaceAccent(w.id) }} aria-hidden>
                  {workspaceInitialsFromLabel(w.name, w.ownerName)}
                </span>
                <span className="relay-ws-copy">
                  <span className="relay-ws-name">{name}</span>
                  <span className="relay-ws-meta">{metaLine(w, t)}</span>
                </span>
              </button>
            );
          })}

          {workspaces.length < 2 && <p className="relay-ws-hint">{t("workspaceSingleHint")}</p>}

          <div className="relay-menu-sep" />

          {active.role === "owner" && (
            <button type="button" className="relay-ws-action" onClick={() => void renameActive()}>
              {t("renameWorkspace")}
            </button>
          )}
          <button
            type="button"
            className="relay-ws-action"
            onClick={() => {
              setOpen(false);
              onInvite?.();
            }}
          >
            {t("invitePeople")}
          </button>
          <button
            type="button"
            className="relay-ws-action"
            disabled={busy}
            onClick={() => void createWorkspace()}
          >
            {t("createWorkspace")}
          </button>
        </div>
      )}
    </div>
  );
}

function labelOf(
  w: Pick<WebWorkspace, "name" | "ownerName">,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return workspaceDisplayName(w.name, w.ownerName, (name) => t("personalWorkspace", { name }));
}

function metaLine(
  w: Pick<WebWorkspace, "memberCount" | "role">,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const role = t(roleKey(w.role));
  const count = w.memberCount || 1;
  if (count <= 1) return `${t("workspacePersonal")} · ${role}`;
  return `${t("workspaceTeamCount", { count })} · ${role}`;
}
