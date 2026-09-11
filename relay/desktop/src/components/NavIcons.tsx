import type { ReactNode } from "react";
import type { ViewId } from "../App";

const size = 18;

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="nav-ico-svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function NavIcon({ id }: { id: ViewId }) {
  switch (id) {
    case "home":
      return (
        <Svg>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-5.4H10.2V21H5a1 1 0 0 1-1-1v-9.5Z" />
        </Svg>
      );
    case "board":
      return (
        <Svg>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </Svg>
      );
    case "pages":
      return (
        <Svg>
          <path d="M7 3.5h7.2L19.5 9v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
          <path d="M14 3.5V9h5.5" />
          <path d="M9 13h6M9 16.5h4.5" />
        </Svg>
      );
    case "team":
      return (
        <Svg>
          <circle cx="9" cy="8.5" r="2.6" />
          <circle cx="16.2" cy="9.2" r="2.2" />
          <path d="M3.8 18.5c.6-3 2.6-4.6 5.2-4.6s4.6 1.6 5.2 4.6" />
          <path d="M13.2 14.6c1.5-.5 3.2-.2 4.5 1.1.8.8 1.3 1.8 1.5 2.8" />
        </Svg>
      );
    case "theme":
      return (
        <Svg>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.55 1.55M16.65 16.65l1.55 1.55M18.2 5.8l-1.55 1.55M7.35 16.65 5.8 18.2" />
        </Svg>
      );
    case "auth":
      return (
        <Svg>
          <circle cx="12" cy="9" r="3.2" />
          <path d="M5.2 19.2c1.1-3.1 3.4-4.7 6.8-4.7s5.7 1.6 6.8 4.7" />
        </Svg>
      );
  }
}

export function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="nav-ico-svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
    >
      <path d="M15 6 9 12l6 6" />
    </svg>
  );
}
