"use client";

import { useEffect, useMemo } from "react";
import { SaveBatch } from "./save-batch";

export function useSaveBatch<Patch extends object>(scope: unknown) {
  const batch = useMemo(() => new SaveBatch<Patch>(), [scope]);
  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") batch.flushInBackground();
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", batch.flushInBackground);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", batch.flushInBackground);
      batch.flushInBackground();
    };
  }, [batch]);
  return batch;
}
