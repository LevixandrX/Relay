import { nanoid } from "nanoid";

export const id = {
  user: () => `usr_${nanoid(12)}`,
  workspace: () => `ws_${nanoid(12)}`,
  membership: () => `mem_${nanoid(12)}`,
  page: () => `pg_${nanoid(12)}`,
  invite: () => `inv_${nanoid(12)}`,
  revision: () => `rev_${nanoid(12)}`,
  public: () => nanoid(21),
  token: () => nanoid(32),
};

export function now() {
  return new Date().toISOString();
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${nanoid(6)}`;
}
