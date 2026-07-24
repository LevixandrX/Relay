import type { ReactNode } from "react";
import type { Doc, JSONContent } from "@/domain/blocks/schema";

function Inline({ nodes }: { nodes?: JSONContent[] }) {
  if (!nodes) return null;
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "text") {
          let el: ReactNode = n.text;
          const marks = (n.marks ?? []) as { type: string; attrs?: { href?: string } }[];
          for (const m of marks) {
            if (m.type === "bold") el = <strong key={`b${i}`}>{el}</strong>;
            if (m.type === "italic") el = <em key={`i${i}`}>{el}</em>;
            if (m.type === "code") el = <code key={`c${i}`}>{el}</code>;
            if (m.type === "link" && m.attrs?.href)
              el = (
                <a key={`a${i}`} href={m.attrs.href} rel="noopener noreferrer">
                  {el}
                </a>
              );
          }
          return <span key={i}>{el}</span>;
        }
        return null;
      })}
    </>
  );
}

function Block({ node }: { node: JSONContent }) {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
      return (
        <Tag>
          <Inline nodes={node.content} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p>
          <Inline nodes={node.content} />
        </p>
      );
    case "bulletList":
      return (
        <ul>
          {node.content?.map((c, i) => (
            <li key={i}>
              {c.content?.map((p, j) => (
                <Block key={j} node={p} />
              ))}
            </li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol>
          {node.content?.map((c, i) => (
            <li key={i}>
              {c.content?.map((p, j) => (
                <Block key={j} node={p} />
              ))}
            </li>
          ))}
        </ol>
      );
    case "taskList":
      return (
        <ul className="relay-task-list">
          {node.content?.map((c, i) => (
            <li key={i} data-checked={String(Boolean(c.attrs?.checked))}>
              <input type="checkbox" checked={Boolean(c.attrs?.checked)} readOnly />
              <div>
                {c.content?.map((p, j) => (
                  <Block key={j} node={p} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      );
    case "codeBlock":
      return (
        <pre>
          <code>
            <Inline nodes={node.content} />
          </code>
        </pre>
      );
    case "blockquote":
      return (
        <blockquote>
          {node.content?.map((c, i) => (
            <Block key={i} node={c} />
          ))}
        </blockquote>
      );
    case "horizontalRule":
      return <hr />;
    case "callout":
      return (
        <div className="relay-callout">
          <span className="relay-callout-emoji">{String(node.attrs?.emoji ?? "💡")}</span>
          <div>
            {node.content?.map((c, i) => (
              <Block key={i} node={c} />
            ))}
          </div>
        </div>
      );
    case "promptBlock":
      return (
        <div className="relay-prompt is-readonly">
          <div className="relay-prompt-label">Live Prompt</div>
          <p>{String(node.attrs?.prompt ?? "")}</p>
        </div>
      );
    default:
      return null;
  }
}

export function DocRenderer({ doc }: { doc: Doc }) {
  return (
    <div className="relay-doc-render">
      {doc.content?.map((n, i) => (
        <Block key={i} node={n} />
      ))}
    </div>
  );
}
