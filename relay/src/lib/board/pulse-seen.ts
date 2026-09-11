const EVENT = "relay-pulse-seen";

export function pulseSeenKey(workspaceId: string) {
  return `relay.pulse.seen.${workspaceId}`;
}

export function readPulseSeen(workspaceId: string): string | null {
  try {
    return localStorage.getItem(pulseSeenKey(workspaceId));
  } catch {
    return null;
  }
}

export function writePulseSeen(workspaceId: string, id: string) {
  try {
    localStorage.setItem(pulseSeenKey(workspaceId), id);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function subscribePulseSeen(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
