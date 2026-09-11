import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { SearchPalette, type SearchHit } from "@relay-search";
import { shortcutHint, useModLabel } from "@relay-board/mod-key";
import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import type { Doc } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenPage: (id: string) => void;
  onOpenBoard: () => void;
  onCreatePage: () => void;
};

function flattenDoc(doc: Doc | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (node: { text?: string; attrs?: { prompt?: unknown }; content?: unknown[] }) => {
    if (node.text) parts.push(node.text);
    if (node.attrs?.prompt) parts.push(String(node.attrs.prompt));
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child as typeof node);
    }
  };
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function snippetAround(hay: string, q: string): string {
  const idx = hay.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return hay.slice(0, 120);
  return hay.slice(Math.max(0, idx - 40), idx + 80);
}

export function CommandPalette({ open, onClose, onOpenPage, onOpenBoard, onCreatePage }: Props) {
  const t = useTranslations("desktop");
  const ta = useTranslations("app");
  const tc = useTranslations("common");
  const searchHint = shortcutHint(useModLabel(), "K");
  const { pages, mode, activeWorkspaceId } = useWorkspace();
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const localHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...pages]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 8)
        .map((p) => ({ id: p.id, title: p.title || tc("untitled"), snippet: "" }));
    }
    const matched: SearchHit[] = [];
    for (const p of pages) {
      const body = flattenDoc(p.content);
      const title = p.title || tc("untitled");
      const inTitle = title.toLowerCase().includes(q);
      const inBody = body.toLowerCase().includes(q);
      if (!inTitle && !inBody) continue;
      matched.push({
        id: p.id,
        title,
        snippet: inBody ? snippetAround(body, q) : undefined,
      });
    }
    return matched.slice(0, 8);
  }, [pages, query, tc]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (mode !== "cloud" || !activeWorkspaceId || !auth.token) {
      setHits(localHits);
      return;
    }
    if (q.length < 1) {
      setHits(localHits);
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await api<{ results: { pageId: string; title: string; snippet: string }[] }>(
            `/workspaces/${activeWorkspaceId}/search?q=${encodeURIComponent(q)}`,
            { token: auth.token },
          );
          setHits(data.results.map((r) => ({ id: r.pageId, title: r.title, snippet: r.snippet })));
        } catch {
          setHits(localHits);
        }
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query, mode, activeWorkspaceId, auth.token, localHits]);

  return (
    <SearchPalette
      open={open}
      onClose={onClose}
      query={query}
      onQueryChange={setQuery}
      label={`${ta("searchTitle")} · ${searchHint}`}
      placeholder={t("pagesSearch")}
      actionsLabel={t("paletteActions")}
      pagesLabel={ta("pages")}
      emptyLabel={t("pagesSearchEmpty")}
      emptyHint={t("pagesSearchEmptyHint")}
      actions={[
        { id: "board", title: ta("infiniteBoard"), onSelect: onOpenBoard },
        { id: "new", title: ta("newPageTitle"), onSelect: onCreatePage },
      ]}
      hits={hits}
      onOpenHit={onOpenPage}
    />
  );
}
