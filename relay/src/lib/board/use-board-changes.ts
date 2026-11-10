"use client";

import { useEffect, useRef } from "react";

export function useBoardChanges<Snapshot>(
  store: { listen: (listener: () => void, options: { source: "user" }) => () => void; getSnapshot: () => unknown },
  onChange: ((readSnapshot: () => Snapshot) => void) | undefined,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const enabled = Boolean(onChange);

  useEffect(() => {
    if (!enabled) return;
    return store.listen(() => {
      onChangeRef.current?.(() => store.getSnapshot() as Snapshot);
    }, { source: "user" });
  }, [store, enabled]);
}
