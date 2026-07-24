import { z } from "zod";

const EMBED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.figma.com",
  "www.loom.com",
  "loom.com",
]);

const markSchema = z.object({
  type: z.enum(["bold", "italic", "code", "strike", "link"]),
  attrs: z
    .object({
      href: z.string().max(2000).optional(),
      target: z.string().optional(),
      rel: z.string().optional(),
      class: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

const textNode = z.object({
  type: z.literal("text"),
  text: z.string().max(20_000),
  marks: z.array(markSchema).max(8).optional(),
});

type Inline = z.infer<typeof textNode> | { type: string; content?: unknown[]; attrs?: unknown };

const inlineContent: z.ZodType<Inline[]> = z.lazy(() =>
  z.array(z.union([textNode, z.object({ type: z.string(), content: z.any().optional(), attrs: z.any().optional() })]))
);

export type JSONContent = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export const blockNode: z.ZodType<JSONContent> = z.lazy(() =>
  z
    .object({
      type: z.string(),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(blockNode).max(500).optional(),
      text: z.string().optional(),
      marks: z.array(markSchema).optional(),
    })
    .superRefine((node, ctx) => {
      const allowed = new Set([
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "listItem",
        "taskList",
        "taskItem",
        "codeBlock",
        "blockquote",
        "horizontalRule",
        "hardBreak",
        "callout",
        "promptBlock",
        "image",
        "embed",
        "text",
      ]);
      if (!allowed.has(node.type)) {
        ctx.addIssue({ code: "custom", message: `Unknown block type: ${node.type}` });
      }
      if (node.type === "heading") {
        const level = Number(node.attrs?.level ?? 1);
        if (level < 1 || level > 3) {
          ctx.addIssue({ code: "custom", message: "Heading level must be 1–3" });
        }
      }
      if (node.type === "embed") {
        const url = String(node.attrs?.url ?? "");
        try {
          const host = new URL(url).hostname;
          if (!EMBED_HOSTS.has(host)) {
            ctx.addIssue({ code: "custom", message: "Embed host not allowed" });
          }
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid embed URL" });
        }
      }
    }),
);

export const docSchema = z.object({
  type: z.literal("doc"),
  content: z.array(blockNode).max(2_000).optional(),
});

export type Doc = z.infer<typeof docSchema>;

export function parseDoc(input: unknown): Doc {
  const raw = JSON.stringify(input);
  if (raw.length > 500_000) {
    throw new Error("Document too large");
  }
  return docSchema.parse(input);
}

export function emptyDoc(): Doc {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

/** Flatten AST text for search indexing */
export function docToPlainText(doc: Doc | JSONContent): string {
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.text) parts.push(node.text);
    if (node.type === "promptBlock" && node.attrs?.prompt) {
      parts.push(String(node.attrs.prompt));
    }
    node.content?.forEach(walk);
  };
  walk(doc as JSONContent);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function paragraphs(...texts: string[]): Doc {
  return {
    type: "doc",
    content: texts.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : undefined,
    })),
  };
}

void inlineContent;
