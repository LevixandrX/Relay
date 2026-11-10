"use client";

import { useTranslations } from "use-intl";

export function ActivitySpinner() {
  return (
    <svg className="relay-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <path
          key={i}
          d="M12 3.5v4"
          transform={`rotate(${i * 45} 12 12)`}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity={(i + 1) / 8}
        />
      ))}
    </svg>
  );
}

type LoadingProps = { label?: string } & (
  | { centered: true; inline?: never }
  | { centered?: false; inline?: boolean }
);

export function LoadingIndicator({ label, inline = false, centered = false }: LoadingProps) {
  const t = useTranslations("common");
  const indicator = (
    <span className="relay-loading" data-variant={centered ? "centered" : inline ? "inline" : undefined} role="status">
      {centered ? <span className="relay-loading-line" aria-hidden /> : <ActivitySpinner />}
      <span>{label ?? t("loading")}</span>
    </span>
  );
  return centered ? <div className="relay-loading-area">{indicator}</div> : indicator;
}
