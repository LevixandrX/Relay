"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type Member = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  role: string;
  pageId: string | null;
  publicId: string | null;
  publicUrl: string | null;
  onTogglePublish: () => Promise<void>;
};

export function WorkspaceShareModal({
  open,
  onClose,
  workspaceId,
  workspaceName,
  role,
  pageId,
  publicId,
  publicUrl,
  onTogglePublish,
}: Props) {
  const t = useTranslations("app");
  const tc = useTranslations("common");
  const td = useTranslations("desktop");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pubCopied, setPubCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const canInvite = role === "owner";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInviteUrl(null);
    setInviteEmail(null);
    setCopied(false);
    setPubCopied(false);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { members: Member[] };
        if (!cancelled) setMembers(data.members ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  if (!open) return null;

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    setCopied(false);
    const target = email.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target, role: "editor" }),
      });
      const data = (await res.json()) as { acceptToken?: string; message?: string };
      if (!res.ok || !data.acceptToken) {
        setError(data.message || t("inviteFailed"));
        return;
      }
      setInviteUrl(`${window.location.origin}/invite/${data.acceptToken}`);
      setInviteEmail(target);
      setEmail("");
      const memRes = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
        credentials: "include",
      });
      if (memRes.ok) {
        const memData = (await memRes.json()) as { members: Member[] };
        setMembers(memData.members ?? []);
      }
    } catch {
      setError(t("inviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, kind: "invite" | "pub") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "invite") setCopied(true);
      else setPubCopied(true);
    } catch {
      if (kind === "invite") setCopied(false);
      else setPubCopied(false);
    }
  }

  function mailHref() {
    if (!inviteUrl || !inviteEmail) return "#";
    const subject = encodeURIComponent(td("inviteMailSubject", { workspace: workspaceName }));
    const body = encodeURIComponent(
      td("inviteMailBody", { workspace: workspaceName, url: inviteUrl }),
    );
    return `mailto:${inviteEmail}?subject=${subject}&body=${body}`;
  }

  return createPortal(
    <>
      <div className="relay-modal-backdrop" onClick={onClose} />
      <div className="relay-modal relay-share-modal" role="dialog" aria-modal="true">
        <header className="relay-share-head">
          <div>
            <h2>{t("shareTitle")}</h2>
            <p className="relay-modal-lede">{t("shareLede")}</p>
          </div>
          <button
            type="button"
            className="relay-icon-btn relay-icon-btn-surface"
            onClick={onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>

        <section className="relay-share-block">
          <div className="relay-share-block-head">
            <h3>{t("invitePeople")}</h3>
            <p>{t("shareInviteLede")}</p>
          </div>

          {members.length > 0 && (
            <ul className="relay-share-members">
              {members.map((m) => (
                <li key={m.userId}>
                  <span className="relay-share-avatar" aria-hidden>
                    {(m.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="relay-share-member-copy">
                    <strong>{m.name}</strong>
                    <span>{m.email}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canInvite ? (
            <form className="relay-share-invite" onSubmit={(e) => void invite(e)}>
              <input
                className="relay-input relay-input-compact"
                type="email"
                autoComplete="email"
                placeholder={t("invitePlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="relay-btn relay-btn-accent relay-btn-compact" type="submit" disabled={busy}>
                {busy ? td("inviteSending") : td("inviteSend")}
              </button>
            </form>
          ) : (
            <p className="relay-muted">{td("inviteOwnerOnly")}</p>
          )}

          {error && <p className="relay-error">{error}</p>}

          {inviteUrl && (
            <div className="relay-share-ready">
              <p className="relay-muted">{td("inviteReadyHint")}</p>
              <div className="relay-share-link-row">
                <input
                  className="relay-input relay-input-compact"
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="relay-btn relay-btn-compact"
                  onClick={() => void copyText(inviteUrl, "invite")}
                >
                  {copied ? td("inviteCopied") : td("inviteCopy")}
                </button>
              </div>
              <a className="relay-btn relay-btn-ghost relay-btn-compact" href={mailHref()}>
                {td("inviteOpenMail")}
              </a>
            </div>
          )}
        </section>

        {pageId && (
          <section className="relay-share-block">
            <div className="relay-share-block-head">
              <h3>{t("publish")}</h3>
              <p>{t("sharePublishLede")}</p>
            </div>

            {!publicId ? (
              <button
                type="button"
                className="relay-btn relay-btn-accent relay-btn-compact"
                onClick={() => void onTogglePublish()}
              >
                {t("publish")}
              </button>
            ) : (
              <div className="relay-share-ready">
                <div className="relay-share-link-row">
                  <input
                    className="relay-input relay-input-compact"
                    readOnly
                    value={publicUrl ?? ""}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="relay-btn relay-btn-compact"
                    onClick={() => publicUrl && void copyText(publicUrl, "pub")}
                  >
                    {pubCopied ? td("inviteCopied") : td("inviteCopy")}
                  </button>
                </div>
                <button
                  type="button"
                  className="relay-btn relay-btn-ghost relay-btn-compact"
                  onClick={() => void onTogglePublish()}
                >
                  {t("unpublish")}
                </button>
              </div>
            )}
          </section>
        )}

        <div className="relay-dialog-actions">
          <button type="button" className="relay-btn relay-btn-accent" onClick={onClose}>
            {tc("done")}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
