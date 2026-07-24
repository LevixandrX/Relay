import type { Doc, JSONContent } from "@/domain/blocks/schema";
import { docToPlainText, parseDoc } from "@/domain/blocks/schema";

function extractHeadings(doc: Doc): string[] {
  const out: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "heading") {
      const t = (n.content ?? []).map((c) => c.text ?? "").join("");
      if (t) out.push(t);
    }
    n.content?.forEach(walk);
  };
  walk(doc as JSONContent);
  return out;
}

function extractTasks(doc: Doc): { text: string; checked: boolean }[] {
  const out: { text: string; checked: boolean }[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "taskItem") {
      const text = docToPlainText({ type: "doc", content: n.content });
      out.push({ text, checked: Boolean(n.attrs?.checked) });
    }
    n.content?.forEach(walk);
  };
  walk(doc as JSONContent);
  return out;
}

/** Offline-capable Live Prompt — always available without API keys. */
export function runLocalPrompt(doc: Doc, prompt: string): Doc {
  const p = prompt.toLowerCase();
  const plain = docToPlainText(doc);
  const headings = extractHeadings(doc);
  const tasks = extractTasks(doc);

  if (p.includes("summar") || p.includes("bullet")) {
    const bullets =
      headings.length > 0
        ? headings.slice(0, 5)
        : plain
            .split(/[.!?]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 3);
    return {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Summary" }],
        },
        {
          type: "bulletList",
          content: bullets.map((b) => ({
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: b }] }],
          })),
        },
      ],
    };
  }

  if (p.includes("email") || p.includes("letter")) {
    const lines = tasks.length
      ? tasks.map((t) => `- [${t.checked ? "x" : " "}] ${t.text}`).join("\n")
      : plain.slice(0, 400);
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Subject: Update from Relay" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hi — quick update based on this page:" }],
        },
        {
          type: "codeBlock",
          attrs: { language: "text" },
          content: [{ type: "text", text: lines || "(empty page)" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Thanks," }],
        },
      ],
    };
  }

  if (p.includes("action") || p.includes("checklist") || p.includes("week")) {
    const items =
      tasks.length > 0
        ? tasks.map((t) => t.text)
        : headings.length > 0
          ? headings
          : ["Clarify goal", "Ship one slice", "Share a public link"];
    return {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Action items" }],
        },
        {
          type: "taskList",
          content: items.slice(0, 8).map((text) => ({
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          })),
        },
      ],
    };
  }

  // Default: reflective rewrite of first sentences
  const snippet = plain.slice(0, 280) || "Empty page — add a few lines, then run again.";
  return {
    type: "doc",
    content: [
      {
        type: "callout",
        attrs: { emoji: "⚡" },
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `Relay local runner (no API key). Prompt: “${prompt.slice(0, 120)}”`,
              },
            ],
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: snippet }],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Tip: try “summarize into 3 bullets”, “turn into email”, or “extract action items”.",
          },
        ],
      },
    ],
  };
}

export async function runPrompt(doc: Doc, prompt: string): Promise<Doc> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return parseDoc(runLocalPrompt(doc, prompt));
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You transform a Notion-like page. Reply with ONLY valid TipTap JSON: {type:'doc', content:[...]} using paragraph, heading (level 1-3), bulletList, listItem, taskList, taskItem, codeBlock, blockquote, callout. No markdown fences.",
          },
          {
            role: "user",
            content: JSON.stringify({ prompt, page: doc }),
          },
        ],
      }),
    });
    if (!res.ok) return parseDoc(runLocalPrompt(doc, prompt));
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    return parseDoc(JSON.parse(cleaned));
  } catch {
    return parseDoc(runLocalPrompt(doc, prompt));
  }
}

/** Merge generated blocks after the prompt block in the page. */
export function insertAfterPrompt(
  doc: Doc,
  promptText: string,
  generated: Doc,
): Doc {
  const content = [...(doc.content ?? [])];
  let idx = content.findIndex(
    (n) => n.type === "promptBlock" && String(n.attrs?.prompt ?? "") === promptText,
  );
  if (idx < 0) {
    idx = content.findIndex((n) => n.type === "promptBlock");
  }
  const insert = generated.content ?? [];
  if (idx < 0) {
    return { type: "doc", content: [...content, ...insert] };
  }
  const next = [...content];
  next.splice(idx + 1, 0, ...insert);
  if (next[idx]?.type === "promptBlock") {
    next[idx] = {
      ...next[idx],
      attrs: { ...next[idx].attrs, status: "done" },
    };
  }
  return { type: "doc", content: next };
}
