import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { useAuth, type CloudWorkspace } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { api, ApiClientError } from "../lib/api";
import { useDialog } from "./DialogHost";
import {
  workspaceAccent,
  workspaceDisplayName,
  workspaceMark,
} from "../lib/workspace-meta";

function roleKey(role: string) {
  if (role === "owner") return "roleOwner" as const;
  if (role === "editor") return "roleEditor" as const;
  return "roleViewer" as const;
}

function displayName(
  w: CloudWorkspace,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return workspaceDisplayName(w.name, w.ownerName, (name) =>
    t("personalWorkspace", { name }),
  );
}

function metaLine(
  w: CloudWorkspace,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const role = t(roleKey(w.role));
  const count = w.memberCount ?? 1;
  if (count <= 1) return `${t("workspacePersonal")} · ${role}`;
  return `${t("workspaceTeamCount", { count })} · ${role}`;
}

/**
 * Always a menu (Notion/Linear pattern): even with one workspace you can
 * rename, invite, or create another — so the chip is never a dead label.
 */
export function WorkspaceSwitcher({
  collapsed,
  onExpand,
  onInvite,
}: {
  collapsed: boolean;
  onExpand?: () => void;
  onInvite?: () => void;
}) {
  const t = useTranslations("desktop");
  const auth = useAuth();
  const ws = useWorkspace();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const active =
    auth.workspaces.find((w) => w.id === ws.activeWorkspaceId) ?? auth.workspaces[0] ?? null;

  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

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

  if (ws.mode !== "cloud" || !active) return null;

  const label = displayName(active, t);
  const sub = metaLine(active, t);
  const mark = workspaceMark(active.name, active.ownerName);

  if (collapsed) {
    return (
      <button
        type="button"
        className="ws-mark-btn"
        title={`${label} · ${sub}`}
        aria-label={label}
        onClick={() => onExpand?.()}
      >
        <span className="ws-mark" style={{ background: workspaceAccent(active.id) }} aria-hidden>
          {mark}
        </span>
      </button>
    );
  }

  async function createWorkspace() {
    if (!auth.token || busy) return;
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
      const res = await api<{ id: string }>("/workspaces", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ name }),
      });
      await auth.refreshMe();
      ws.setActiveWorkspace(res.id);
      setOpen(false);
    } catch (err) {
      await dialog.alert({
        title: t("createWorkspaceFailed"),
        body: err instanceof ApiClientError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function renameActive() {
    if (!auth.token || busy || active.role !== "owner") return;
    const next = (
      await dialog.prompt({
        title: t("renameWorkspacePrompt"),
        defaultValue: label,
        confirmLabel: t("renameWorkspace"),
      })
    )?.trim();
    if (!next || next === active.name) return;
    setBusy(true);
    try {
      await api(`/workspaces/${active.id}`, {
        method: "PATCH",
        token: auth.token,
        body: JSON.stringify({ name: next }),
      });
      await auth.refreshMe();
      setOpen(false);
    } catch (err) {
      await dialog.alert({
        title: t("renameWorkspaceFailed"),
        body: err instanceof ApiClientError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws-switch" ref={rootRef}>
      <button
        type="button"
        className="ws-switch-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ws-mark" style={{ background: workspaceAccent(active.id) }} aria-hidden>
          {mark}
        </span>
        <span className="ws-switch-copy">
          <span className="ws-switch-name">{label}</span>
          <span className="ws-switch-role">{sub}</span>
        </span>
        <span className="ws-switch-chevron" data-open={open || undefined} aria-hidden>
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
        <div className="ws-menu" id={listId} role="listbox" aria-label={t("workspaceAria")}>
          <div className="ws-menu-label">{t("workspaceSwitcherLabel")}</div>
          {auth.workspaces.map((w) => {
            const selected = w.id === active.id;
            const name = displayName(w, t);
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={selected}
                className="ws-menu-item"
                data-active={selected}
                onClick={() => {
                  ws.setActiveWorkspace(w.id);
                  setOpen(false);
                }}
              >
                <span
                  className="ws-mark"
                  style={{ background: workspaceAccent(w.id) }}
                  aria-hidden
                >
                  {workspaceMark(w.name, w.ownerName)}
                </span>
                <span className="ws-menu-copy">
                  <span className="ws-menu-name">{name}</span>
                  <span className="ws-menu-role">{metaLine(w, t)}</span>
                </span>
                {selected && (
                  <span className="ws-menu-check" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7.2 5.8 10 11 4"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}

          {auth.workspaces.length < 2 && (
            <p className="ws-menu-hint">{t("workspaceSingleHint")}</p>
          )}

          <div className="ws-menu-sep" />

          {active.role === "owner" && (
            <button type="button" className="ws-menu-action" onClick={() => void renameActive()}>
              {t("renameWorkspace")}
            </button>
          )}
          <button
            type="button"
            className="ws-menu-action"
            onClick={() => {
              setOpen(false);
              onInvite?.();
            }}
          >
            {t("invitePeople")}
          </button>
          <button
            type="button"
            className="ws-menu-action"
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
