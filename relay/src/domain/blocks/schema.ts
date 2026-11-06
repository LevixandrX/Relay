import {CALLOUT_ICON_NAMES} from './callout-icons';
import { z } from "zod";
import {MAX_COLUMNS, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH} from './columns';
import { MEDIA_TYPES, webUrl, embedUrl, RICH_BLOCKS, validTable } from './rich-content';

const markSchema = z.object({
  type: z.enum(["bold", "italic", "code", "strike", "link", "underline", "textStyle"]),
  attrs: z
    .object({
      href: z.string().max(2000).optional(),
      target: z.string().optional(),
      rel: z.string().optional(),
      class: z.string().optional(),
    })
    .passthrough().superRefine((attrs,ctx)=>{for(const key of ['color','backgroundColor']){const value=attrs[key];if(value!=null&&(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)))ctx.addIssue({code:'custom',message:'Invalid inline color'});}})
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
      for (const attr of ["textColor", "blockBackground", "cellBackground","cellTextColor","iconColor"]) {
        const value = node.attrs?.[attr];
        if (value != null && (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))) ctx.addIssue({ code: "custom", message: "Invalid block color" });
      }
      if (node.attrs?.blockId != null && (typeof node.attrs.blockId !== "string" || !/^blk_[a-zA-Z0-9-]{8,80}$/.test(node.attrs.blockId))) ctx.addIssue({ code: "custom", message: "Invalid block ID" });
      if(node.attrs?.iconAssetId!=null&&(typeof node.attrs.iconAssetId!=='string'||!/^asset_[\w-]{8,80}$/.test(node.attrs.iconAssetId)))ctx.addIssue({code:'custom',message:'Invalid icon asset'});
      if(node.attrs?.iconName!=null&&(typeof node.attrs.iconName!=='string'||!CALLOUT_ICON_NAMES.includes(node.attrs.iconName as never)))ctx.addIssue({code:'custom',message:'Invalid icon'});
      if(node.attrs?.iconSrc!=null&&(typeof node.attrs.iconSrc!=='string'||!webUrl(node.attrs.iconSrc)))ctx.addIssue({code:'custom',message:'Invalid icon URL'});
      const indent = node.attrs?.blockIndent;
      if(node.attrs?.listStyle!=null&&!['disc','circle','square','decimal','lower-alpha','upper-alpha','lower-roman','upper-roman'].includes(String(node.attrs.listStyle)))ctx.addIssue({code:'custom',message:'Invalid list style'});
      if (indent != null && (typeof indent !== "number" || !Number.isInteger(indent) || indent < 0 || indent > 8)) ctx.addIssue({ code: "custom", message: "Invalid block indent" });
      if (node.type === "columns" && (!node.content || node.content.length < 2 || node.content.length > MAX_COLUMNS || node.content.some((child) => child.type !== "column"))) ctx.addIssue({ code: "custom", message: `Columns require 2–${MAX_COLUMNS} column nodes` });
      if(node.type==='columns'){
        for(const attr of ['layoutStart','layoutEnd']){const value=node.attrs?.[attr];if(value!=null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1))ctx.addIssue({code:'custom',message:'Invalid row edge'});}
        if(typeof node.attrs?.layoutStart==='number'&&typeof node.attrs?.layoutEnd==='number'&&node.attrs.layoutStart>=node.attrs.layoutEnd)ctx.addIssue({code:'custom',message:'Row edges must not cross'});
      }
      if (node.type === "column") {
        const width = node.attrs?.width;
        if (width != null && (typeof width !== "number" || !Number.isFinite(width) || width < MIN_COLUMN_WIDTH || width > MAX_COLUMN_WIDTH)) ctx.addIssue({ code: "custom", message: "Invalid column width" });
        if (!node.content?.length || node.content.some((child) => ["text","hardBreak","column","listItem","taskItem"].includes(child.type))) ctx.addIssue({ code: "custom", message: "Column requires blocks" });
      }
      const allowed = new Set([
        "columns", "column",
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
        ...RICH_BLOCKS, 'tableRow', 'tableCell', 'tableHeader', 'toggleTitle', 'toggleContent', 'inlineEquation',
      ]);
      if (!allowed.has(node.type)) {
        ctx.addIssue({ code: "custom", message: `Unknown block type: ${node.type}` });
      }
      if (node.type === "heading") {
        const level = Number(node.attrs?.level ?? 1);
        if (!Number.isInteger(level) || level < 1 || level > 4) {
          ctx.addIssue({ code: "custom", message: "Heading level must be 1–4" });
        }
      }
      if(node.type==='codeBlock'){if(node.attrs?.wrap!=null&&typeof node.attrs.wrap!=='boolean')ctx.addIssue({code:'custom',message:'Invalid code wrapping'});if(node.attrs?.caption!=null&&(typeof node.attrs.caption!=='string'||node.attrs.caption.length>1000))ctx.addIssue({code:'custom',message:'Invalid code caption'});}
      if (node.type === "embed") {
        const url = node.attrs?.src || node.attrs?.url;
        if (url && !embedUrl(url)) ctx.addIssue({code:'custom',message:'Embed host not allowed'});
      }
      if ([...MEDIA_TYPES, 'bookmark'].includes(node.type as never)) {
        if (node.attrs?.src && !webUrl(node.attrs.src)) ctx.addIssue({code:'custom',message:'Invalid media URL'});
        if (node.attrs?.assetId && (typeof node.attrs.assetId !== 'string' || !/^asset_[\w-]{8,80}$/.test(node.attrs.assetId))) ctx.addIssue({code:'custom',message:'Invalid asset ID'});
        if (node.attrs?.width != null && (typeof node.attrs.width !== 'number' || node.attrs.width < 10 || node.attrs.width > 100)) ctx.addIssue({code:'custom',message:'Invalid media width'});
      }
      if (['equation','inlineEquation'].includes(node.type) && (typeof node.attrs?.latex !== 'string' || node.attrs.latex.length > 4000)) ctx.addIssue({code:'custom',message:'Invalid equation'});
      if (node.type === 'toggle' && (node.content?.length !== 2 || node.content[0].type !== 'toggleTitle' || node.content[1].type !== 'toggleContent')) ctx.addIssue({code:'custom',message:'Invalid toggle structure'});
      if (node.type === 'toggle' && ![0,1,2,3,4].includes(Number(node.attrs?.level ?? 0))) ctx.addIssue({code:'custom',message:'Invalid toggle heading'});
      if (node.type === 'table' && (!node.content?.length || node.content.length > 100 || node.content.some(c => c.type !== 'tableRow') || !validTable(node.content))) ctx.addIssue({code:'custom',message:'Invalid table rows'});
      if (node.type === 'tableRow' && ((node.content?.length??0) > 50 || node.content?.some(c => !['tableCell','tableHeader'].includes(c.type)))) ctx.addIssue({code:'custom',message:'Invalid table cells'});
      if (['tableCell','tableHeader'].includes(node.type)) {
        for (const key of ['colspan','rowspan']) { const v = node.attrs?.[key] ?? 1; if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 100) ctx.addIssue({code:'custom',message:'Invalid cell span'}); }
        const widths = node.attrs?.colwidth;
        if (widths != null && (!Array.isArray(widths) || widths.length > 50 || widths.some(w => typeof w !== 'number' || !Number.isFinite(w) || w < 0 || w > 10000))) ctx.addIssue({code:'custom',message:'Invalid column widths'});
      }
      if (node.type === 'pageLink' && node.attrs?.pageId && (typeof node.attrs.pageId !== 'string' || node.attrs.pageId.length > 100)) ctx.addIssue({code:'custom',message:'Invalid page link'});
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
  const doc = docSchema.parse(input);
  const checkLayout = (node: JSONContent, parent: string) => {
    if (node.type === "column" && parent !== "columns") throw new Error("Column must belong to columns");
    const parents: Record<string,string[]> = {tableRow:['table'],tableCell:['tableRow'],tableHeader:['tableRow'],toggleTitle:['toggle'],toggleContent:['toggle']};
    if(parents[node.type] && !parents[node.type].includes(parent)) throw new Error('Invalid block parent');
    node.content?.forEach((child) => checkLayout(child,node.type));
  };
  doc.content?.forEach((node) => checkLayout(node,"doc"));
  return doc;
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
    if(['equation','inlineEquation'].includes(node.type)&&node.attrs?.latex)parts.push(String(node.attrs.latex));
    if(['image','video','audio','file','pdf','bookmark','embed','pageLink'].includes(node.type))parts.push(String(node.attrs?.caption||node.attrs?.title||node.attrs?.name||''));
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
