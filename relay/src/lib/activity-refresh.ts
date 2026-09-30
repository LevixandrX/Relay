export const ACTIVITY_CHANGED_EVENT = "relay:activity-changed";

export type ActivityChangedDetail = {
  workspaceId?: string | null;
  pageId?: string | null;
};

export function notifyActivityChanged(detail: ActivityChangedDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ActivityChangedDetail>(ACTIVITY_CHANGED_EVENT, { detail }));
}

export function subscribeActivityChanged(listener: (detail: ActivityChangedDetail) => void) {
  if (typeof window === "undefined") return () => undefined;
  const onChanged = (event: Event) => {
    listener((event as CustomEvent<ActivityChangedDetail>).detail ?? {});
  };
  window.addEventListener(ACTIVITY_CHANGED_EVENT, onChanged);
  return () => window.removeEventListener(ACTIVITY_CHANGED_EVENT, onChanged);
}
