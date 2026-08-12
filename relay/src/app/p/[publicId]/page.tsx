import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { pages } from "@/db/schema";
import { DocRenderer } from "@/editor/DocRenderer";
import type { Doc } from "@/domain/blocks/schema";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = { params: Promise<{ publicId: string }> };

export default async function PublicPage({ params }: Props) {
  const { publicId } = await params;
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.publicId, publicId), isNull(pages.deletedAt)))
    .limit(1);
  const page = rows[0];
  if (!page) notFound();

  const content = JSON.parse(page.content) as Doc;

  return (
    <div className="relay-landing" style={{ minHeight: "100%" }}>
      <nav className="relay-landing-nav">
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <BrandLockup size={26} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Публичная страница</span>
          <ThemeToggle variant="toolbar" />
        </div>
      </nav>
      <article className="relay-page" style={{ paddingTop: "1rem" }}>
        <h1 className="relay-title" style={{ marginBottom: "1.25rem" }}>
          {(page.icon ? `${page.icon} ` : "") + (page.title || "Без названия")}
        </h1>
        <DocRenderer doc={content} />
      </article>
    </div>
  );
}
