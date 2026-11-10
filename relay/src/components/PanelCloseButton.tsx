"use client";

import { X } from "lucide-react";
import type { RefObject } from "react";

export function PanelCloseButton(props: {
  ref?: RefObject<HTMLButtonElement | null>;
  "aria-label": string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="relay-panel-close" {...props}>
      <X size={16} aria-hidden />
    </button>
  );
}
