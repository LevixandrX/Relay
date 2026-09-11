"use client";

import { useState } from "react";

export function UserAvatar({
  name,
  url,
  className,
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().slice(0, 1).toUpperCase() || "?";

  if (url && !failed) {
    return (
      <img
        className={className}
        src={url}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={className} aria-hidden>
      {letter}
    </span>
  );
}
