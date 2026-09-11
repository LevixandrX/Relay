import Link from "next/link";

type Props = {
  size?: number;
  className?: string;
};

/** Shared Relay mark — blue tile with the two-node symbol. */
export function BrandMark({ size = 28, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.png"
      alt=""
      width={size}
      height={size}
      className={className ?? "relay-brand-mark"}
      draggable={false}
    />
  );
}

export function BrandLockup({
  size = 28,
  href,
  wordmark = true,
}: {
  size?: number;
  /** When set, brand is a link (auth pages pass `/`). */
  href?: string;
  /** Compact rails keep the mark and drop the word. */
  wordmark?: boolean;
}) {
  const inner = (
    <>
      <BrandMark size={size} />
      {wordmark ? <span>Relay</span> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="relay-brand relay-brand-link"
        aria-label="На главную"
        title="На главную"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="relay-brand" aria-label={wordmark ? undefined : "Relay"}>
      {inner}
    </div>
  );
}
