/** Default personal workspace title from the owner's first name (Notion/Linear-style). */
export function personalWorkspaceName(userName: string) {
  const first = userName.trim().split(/\s+/).filter(Boolean)[0];
  return first || "Relay";
}

/** Label shown in the switcher. Generic legacy names follow the *owner*, never the viewer. */
export function workspaceDisplayName(
  storedName: string,
  ownerName: string | null | undefined,
  formatPersonal: (ownerFirst: string) => string,
) {
  if (!isGenericWorkspaceName(storedName)) return storedName;
  return formatPersonal(firstName(ownerName));
}

export function workspaceInitialsFromLabel(storedName: string, ownerName: string | null | undefined) {
  const source = isGenericWorkspaceName(storedName) ? firstName(ownerName) : storedName;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Legacy signup default — remap in UI so old DBs don't all look identical. */
export function isGenericWorkspaceName(name: string) {
  const n = name.trim().toLowerCase();
  return (
    n === "моё пространство" ||
    n === "мое пространство" ||
    n === "my workspace" ||
    n === "my space" ||
    n === "relay"
  );
}

export function firstName(userName: string | null | undefined) {
  const first = (userName ?? "").trim().split(/\s+/).filter(Boolean)[0];
  return first || "Relay";
}

/** Skip PATCH when the prompt still matches what the user already sees (incl. legacy generic names). */
export function isWorkspaceRenameUnchanged(
  next: string,
  storedName: string,
  displayLabel: string,
) {
  const n = next.trim();
  if (!n) return true;
  if (n === displayLabel.trim()) return true;
  if (n === storedName.trim()) return true;
  if (isGenericWorkspaceName(storedName) && isGenericWorkspaceName(n)) return true;
  return false;
}

/** Stable accent for workspace avatars when names collide. */
export function workspaceAccent(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 52% 42%)`;
}
