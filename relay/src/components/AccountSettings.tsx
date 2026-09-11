"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { UserAvatar } from "./UserAvatar";
import { GithubMark, GoogleMark, YandexMark } from "./ProviderMarks";

export const ACCOUNT_PROVIDERS = [
  { id: "google" as const, label: "Google", mark: GoogleMark },
  { id: "github" as const, label: "GitHub", mark: GithubMark },
  { id: "yandex" as const, label: "Яндекс", mark: YandexMark },
];

export type AccountProfile = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  providers?: string[];
  hasPassword?: boolean;
};

async function fileToAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function AccountSettings({
  user,
  planLabel,
  busy,
  error,
  onSave,
  onLink,
  onUnlink,
  onLogout,
}: {
  user: AccountProfile;
  planLabel?: string | null;
  busy?: boolean;
  error?: string | null;
  onSave: (input: { name: string; avatarUrl?: string | null }) => Promise<void>;
  onLink: (provider: (typeof ACCOUNT_PROVIDERS)[number]["id"]) => void | Promise<void>;
  onUnlink: (provider: (typeof ACCOUNT_PROVIDERS)[number]["id"]) => Promise<void>;
  onLogout: () => void;
}) {
  const t = useTranslations("app");
  const tc = useTranslations("common");
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const linked = new Set(user.providers ?? []);
  const preview = avatar === undefined ? user.avatarUrl : avatar;

  return (
    <div className="account-settings">
      <div className="account-settings-id">
        <label className="account-settings-avatar">
          <UserAvatar name={name || user.name} url={preview} className="account-avatar account-avatar-lg" />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              void fileToAvatar(file).then(setAvatar).catch(() => {});
            }}
          />
          <span>{t("profileAvatarChange")}</span>
        </label>
        <div className="account-settings-copy">
          <label>
            {t("profileName")}
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="muted">{user.email}</p>
          {planLabel ? <p className="account-settings-plan">{planLabel}</p> : null}
        </div>
      </div>

      <button
        type="button"
        className="btn"
        disabled={busy || !name.trim()}
        onClick={() =>
          void onSave({
            name: name.trim(),
            avatarUrl: avatar,
          })
        }
      >
        {t("profileSave")}
      </button>

      <section className="account-settings-links">
        <h2>{t("linkedAccounts")}</h2>
        <p className="muted">{t("linkedAccountsHint")}</p>
        <div className="account-provider-list">
          {ACCOUNT_PROVIDERS.map(({ id, label, mark: Mark }) => {
            const isLinked = linked.has(id);
            return (
              <div key={id} className="account-provider-row">
                <Mark size={18} />
                <span>{label}</span>
                {isLinked ? (
                  <button
                    type="button"
                    className="linkish"
                    disabled={busy}
                    onClick={() => void onUnlink(id)}
                  >
                    {t("unlinkProvider")}
                  </button>
                ) : (
                  <button type="button" className="linkish" disabled={busy} onClick={() => void onLink(id)}>
                    {t("linkProvider")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error ? <p className="account-settings-error">{error}</p> : null}

      <button type="button" className="btn" onClick={onLogout}>
        {tc("logout")}
      </button>
    </div>
  );
}
