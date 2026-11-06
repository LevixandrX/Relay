import { cloneElement, isValidElement, type ReactNode, type CSSProperties } from "react";
import type { Doc, JSONContent } from "@/domain/blocks/schema";
import {columnIndentBase} from '../domain/blocks/columns';
import {ColumnRowView} from './ColumnRowView';
import {MediaContent} from './MediaContent';
import {mathHTML} from './math';
import {CalloutIcon} from './CalloutIcon';
import {BlockGlyph} from './block-preview';
import {MEDIA_TYPES} from '../domain/blocks/rich-content';

function Inline({ nodes }: { nodes?: JSONContent[] }) {
  if (!nodes) return null;
  return (
    <>
      {nodes.map((n, i) => {
        if(n.type==='hardBreak')return <br key={i}/>;
        if(n.type==='inlineEquation')return <span key={i} dangerouslySetInnerHTML={{__html:mathHTML(String(n.attrs?.latex||''),false)}}/>;
        if (n.type === "text") {
          let el: ReactNode = n.text;
          const marks = (n.marks ?? []) as { type: string; attrs?: { href?: string } }[];
          for (const m of marks) {
            if(m.type==='textStyle'){const attrs=m.attrs as {color?:string;backgroundColor?:string}|undefined;el=<span style={{color:attrs?.color,backgroundColor:attrs?.backgroundColor}}>{el}</span>;}
            if (m.type === "bold") el = <strong key={`b${i}`}>{el}</strong>;
            if(m.type === "strike") el=<s key={`s${i}`}>{el}</s>;
            if(m.type === "underline") el=<u key={`u${i}`}>{el}</u>;
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

function Block({node,publicId,doc}:{node:JSONContent;publicId?:string;doc?:Doc}) {
  const rendered=BlockContent({node,publicId,doc});
  if(!isValidElement<{id?:string;style?:CSSProperties}>(rendered))return rendered;
  return cloneElement(rendered,{id:typeof node.attrs?.blockId==='string'?node.attrs.blockId:undefined,style:{...rendered.props.style,...(node.attrs?.textColor?{color:String(node.attrs.textColor)}:{}),...(node.attrs?.blockBackground?{backgroundColor:String(node.attrs.blockBackground),borderRadius:'var(--radius-ui,10px)',padding:'4px 8px'}:{})}});
}
function BlockContent({ node,publicId,doc }: { node: JSONContent; publicId?:string;doc?:Doc }) {
  const indent = Number(node.attrs?.blockIndent) || 0;
  if (indent) return <div className="relay-indented-block" style={{'--block-indent':indent,marginInlineStart:`${indent*24}px`} as CSSProperties}><Block publicId={publicId} doc={doc} node={{ ...node, attrs: { ...node.attrs, blockIndent: 0 } }} /></div>;
  switch (node.type) {
    case "columns": return <ColumnRowView start={typeof node.attrs?.layoutStart==='number'?node.attrs.layoutStart:null} end={typeof node.attrs?.layoutEnd==='number'?node.attrs.layoutEnd:null} count={node.content?.length??2}>{node.content?.map((child,i) => <Block key={i} publicId={publicId} doc={doc} node={child} />)}</ColumnRowView>;
    case "column": return <div className="relay-column" style={{ flexGrow:(Number(node.attrs?.width)||1)*100,'--column-base-indent':columnIndentBase((node.content??[]).map(child=>Number(child.attrs?.blockIndent)||0)) } as CSSProperties}>{node.content?.map((child,i) => <Block key={i} publicId={publicId} doc={doc} node={child} />)}</div>;
    case 'tableOfContents': {const rows:JSONContent[]=[];const walk=(n:JSONContent)=>{if(n.type==='heading'||n.type==='toggle'&&Number(n.attrs?.level)>0)rows.push(n);n.content?.forEach(walk);};doc?.content?.forEach(walk);return <nav className="rich-contents">{rows.map((n,i)=><a key={i} style={{display:'block',paddingInlineStart:(Number(n.attrs?.level||1)-1)*18}} href={'#'+String(n.attrs?.blockId||'')}>{n.type==='toggle'?n.content?.[0].content?.map(c=>c.text||'').join(''):n.content?.map(c=>c.text||'').join('')}</a>)}</nav>;}
    case 'equation': return <div className="rich-equation" dangerouslySetInnerHTML={{__html:mathHTML(String(node.attrs?.latex||''))}}/>;
    case 'toggle': return <details className="rich-public-toggle" open={node.attrs?.open!==false}><summary style={{fontSize: [15,27,22,18,16][Number(node.attrs?.level)||0],fontWeight:Number(node.attrs?.level)?650:400}}><Inline nodes={node.content?.[0].content}/></summary><div style={{paddingInlineStart:24}}>{node.content?.[1].content?.map((c,i)=><Block key={i} node={c} publicId={publicId} doc={doc}/>)}</div></details>;
    case 'table': return <div className="tableWrapper"><table><tbody>{node.content?.map((row,i)=><tr key={i}>{row.content?.map((cell,j)=>{const Tag=cell.type==='tableHeader'?'th':'td';return <Tag key={j} colSpan={Number(cell.attrs?.colspan)||1} rowSpan={Number(cell.attrs?.rowspan)||1} style={{color:typeof cell.attrs?.cellTextColor==='string'?cell.attrs.cellTextColor:undefined,backgroundColor:typeof cell.attrs?.cellBackground==='string'?cell.attrs.cellBackground:undefined,width:Array.isArray(cell.attrs?.colwidth)?Number(cell.attrs.colwidth[0])||undefined:undefined}}>{cell.content?.map((c,k)=><Block key={k} node={c} publicId={publicId} doc={doc}/>)}</Tag>;})}</tr>)}</tbody></table></div>;
    case 'image':case 'video':case 'audio':case 'file':case 'pdf':case 'bookmark':case 'embed':return <figure className={'rich-media rich-'+node.type} style={{width:String(node.attrs?.width||100)+'%'}}><MediaContent kind={node.type} attrs={node.attrs||{}} publicId={publicId}/>{node.attrs?.caption?<figcaption>{String(node.attrs.caption)}</figcaption>:null}</figure>;
    case 'pageLink':return <p>{String(node.attrs?.title||'↗')}</p>;
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : level === 3 ? "h3" : "h4") as "h1" | "h2" | "h3" | "h4";
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
        <ul style={{listStyleType:typeof node.attrs?.listStyle==='string'?node.attrs.listStyle:undefined}}>
          {node.content?.map((c, i) => (
            <li key={i}>
              {c.content?.map((p, j) => (
                <Block key={j} publicId={publicId} doc={doc} node={p} />
              ))}
            </li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol start={Number(node.attrs?.start)||1} style={{listStyleType:typeof node.attrs?.listStyle==='string'?node.attrs.listStyle:undefined}}>
          {node.content?.map((c, i) => (
            <li key={i}>
              {c.content?.map((p, j) => (
                <Block key={j} publicId={publicId} doc={doc} node={p} />
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
                  <Block key={j} publicId={publicId} doc={doc} node={p} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      );
    case "codeBlock":
      return (
        <div className="rich-code" data-wrap={Boolean(node.attrs?.wrap)}><div className="rich-code-frame"><pre>
          <code>
            <Inline nodes={node.content} />
          </code>
        </pre></div>{node.attrs?.caption?<div className="rich-code-caption">{String(node.attrs.caption)}</div>:null}</div>
      );
    case "blockquote":
      return (
        <blockquote>
          {node.content?.map((c, i) => (
            <Block key={i} publicId={publicId} doc={doc} node={c} />
          ))}
        </blockquote>
      );
    case "horizontalRule":
        return <hr style={{border:0,borderTop:'1px solid currentColor',color:'var(--line)'}}/>;
    case "callout":
      return (
        <div className="relay-callout">
          {node.attrs?.iconAssetId||node.attrs?.iconSrc||node.attrs?.iconName||node.attrs?.emoji!==''?<span className="relay-callout-emoji" style={{color:typeof node.attrs?.iconColor==='string'?node.attrs.iconColor:undefined}}>{node.attrs?.iconAssetId||node.attrs?.iconSrc?<MediaContent kind="image" attrs={{assetId:node.attrs?.iconAssetId?String(node.attrs.iconAssetId):undefined,src:node.attrs?.iconSrc?String(node.attrs.iconSrc):undefined}} publicId={publicId}/>:node.attrs?.iconName?<CalloutIcon name={String(node.attrs.iconName)}/>:String(node.attrs?.emoji??'💡')}</span>:null}
          <div>
            {node.content?.map((c, i) => (
              <Block key={i} publicId={publicId} doc={doc} node={c} />
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

export function DocRenderer({ doc,publicId }: { doc: Doc;publicId?:string }) {
  return (
    <div className="relay-doc-render">
      {doc.content?.map((n, i) => (
        <Block key={i} node={n} publicId={publicId} doc={doc} />
      ))}
    </div>
  );
}
