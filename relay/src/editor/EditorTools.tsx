"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import { useLocale, useTranslations } from "use-intl";
import { OverlayScroll } from "../lib/board/CompactRailScroll";
import { changedActivityBlocks, type ActivityNode, type BlockActivityInfo } from "../lib/block-activity";
import { ColorField } from "../components/ColorField";
import {DateLabel} from '../components/DateLabel';
import { useEditorCanvas } from "./use-editor-canvas";
import { DropIndicator } from "./DropIndicator";
import { BlockComments, type DraftAnchor } from "./BlockComments";
import type { CommentContext, CommentPerson } from "./comment-types";
import { COLOR_NAMES, COLOR_VALUES, applyBlockColor, ensureBlockId } from "./block-appearance";
import { setBlockFilterHint } from "./block-filter";
import { useMenuScrollLock } from "./use-menu-scroll-lock";
import {OverlayPresence,OverlaySurface} from './EditorOverlay';
import {useEditorControls,editorControlsCovered} from './use-editor-controls';
import { BlockGlyph, BlockPreview } from "./block-preview";
import { blockGeometry, editorClipRect, useBlockHandles } from "./use-block-handles";
import { BLOCK_TYPES, actOnBlock, blockAt, blockType, blockAncestor, canMoveBlock, changeBlock, insertAdjacent, listSelectionTarget, listRowTarget, sameBlockSelection, type BlockTarget, type BlockType } from "./block-commands";
type Popup = { kind: "insert" | "actions" | "turn" | "color"; target: BlockTarget; query: string; inline?: boolean; range?: { from: number; to: number } };
const shortcuts: Partial<Record<BlockType, string>> = { h1: "#", h2: "##", h3: "###", bullet: "−", numbered: "1.", todo: "[]", quote: ">", code: "```", divider: "---" };
const keywords: Record<BlockType, string> = { text: "text paragraph текст абзац", h1: "h1 heading заголовок", h2: "h2 heading заголовок", h3: "h3 heading заголовок", bullet: "bullet list список маркированный", numbered: "number ordered list список нумерованный", todo: "todo task checklist задача чеклист", quote: "quote цитата", callout: "callout note tip выноска заметка", code: "code код", divider: "divider line разделитель линия", prompt: "prompt ai ии запрос" };
export function EditorTools({ editor, container, editable, onSlashUsed, allowPrompt = false, comments }: { editor: Editor; container: RefObject<HTMLDivElement | null>; editable: boolean; onSlashUsed?: () => void; allowPrompt?: boolean; comments?: CommentContext }) {
  const controlsVisible=useEditorControls(editor);
  const t = useTranslations("editorTools"), locale = useLocale();
  const [activity, setActivity] = useState<BlockActivityInfo | null>(null);
  const [people,setPeople]=useState<CommentPerson[]>([]);
  const revealActive=useRef(false);
  const commentRequest = useRef(comments?.request); commentRequest.current = comments?.request;
  const id = useId();
  useEditorCanvas(editor, container, editable,Boolean(comments));
  const [commentDraft, setCommentDraft] = useState<DraftAnchor | null>(null);
  const [colorTarget, setColorTarget] = useState<"text" | "background">("text");
  const colorChange = useRef<{ key: string; time: number } | null>(null);
  const actionSelection = useRef<{ from: number; to: number } | null>(null);
  const actionItem=useRef<string|null>(null);
  const comment = (target: BlockTarget, range = actionSelection.current) => {
    if (!comments) return;
    const blockId = ensureBlockId(editor, target);
    const within = range && range.from > target.pos && range.to < target.pos + target.node.nodeSize && range.to > range.from;
    const group=['columns','column','bulletList','orderedList','taskList'].includes(target.node.type.name);
    setCommentDraft({ blockId, quote: (within ? editor.state.doc.textBetween(range!.from, range!.to, "") : (group?target.node.textBetween(0,target.node.content.size,'\n'):target.node.textContent) || String(target.node.attrs.prompt ?? "")).slice(0, 4000), anchorOffset: within ? range!.from - target.pos - 1 : null });
    current.current.popup = null; setPopup(null); setHint(null);
  };
  const [popup, setPopup] = useState<Popup | null>(null);
  const [active, setActive] = useState(0);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [menuHeight, setMenuHeight] = useState(560);
  const menuRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [hintSize, setHintSize] = useState({ width: 260, height: 54 });
  const [hoverPreview, setHoverPreview] = useState<BlockType | null>(null);
  const syncScrollLock = useMenuScrollLock(editor, Boolean(popup), menuRef, id);
  const dismissed = useRef<number | null>(null);
  const [hint, setHint] = useState<"addTip" | "dragTip" | null>(null);
  const current = useRef({ popup, active });
  current.current = { popup, active };
  const openActions = (original: BlockTarget) => {
    const row=listRowTarget(editor,original),selection=editor.state.selection;
    if(row&&['listItem','taskItem'].includes(original.node.type.name)&&selection instanceof NodeSelection&&selection.from===row.pos)original=row;
    ensureBlockId(editor, original);
    const target = blockAt(editor, original.pos, true) ?? original;
    const item=['bulletList','orderedList','taskList'].includes(target.node.type.name)?null:listSelectionTarget(editor,target,'item');
    if(item)actionItem.current=item.node.attrs.blockId;
    actionSelection.current = editor.state.selection.empty || editor.state.selection instanceof NodeSelection ? null : { from: editor.state.selection.from, to: editor.state.selection.to };
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target.pos)));
    setPopup({ kind: "actions", target, query: "" }); setActive(0); setHint(null);
  };
  const { target: hovered, dropLine, ghost, dragging, onGripPointerDown } = useBlockHandles(editor, container, handlesRef, editable, Boolean(popup), openActions, () => { setPopup(null); setHint(null); });
  const addAdjacent = (target: BlockTarget, above: boolean) => {
    const next = insertAdjacent(editor, target, above);
    if (next) {
      const dom = editor.view.nodeDOM(next.pos);
      if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "nearest", inline: "nearest" });
      syncScrollLock();
      const from = editor.state.selection.from;
      setPopup({ kind: "insert", inline: true, target: next, query: "", range: { from, to: from } }); setActive(0); setHint(null);
    }
  };
  const close = (focus = true) => {
    colorChange.current = null;
    if (popup?.range) dismissed.current = popup.range.from;
    current.current.popup = null;
    setPopup(null);
    if (focus) editor.commands.focus();
  };
  const types = BLOCK_TYPES.filter((type) => type !== "prompt" || (allowPrompt && Boolean(editor.schema.nodes.promptBlock)));
  const matches = types.filter((type) => `${t(`blocks.${type}`)} ${keywords[type]}`.toLocaleLowerCase().includes(popup?.query.trim().toLocaleLowerCase() ?? ""));
  const actions = ["turn", "color", "comment", "selectRow", "selectColumn", "selectItem", "selectList", "duplicate", "copyLink", "delete", "addBelow", "addAbove", "copy", "up", "down"] as const;
  type Action = typeof actions[number];
  type Entry = { key: string; label: string; glyph: string; group: number; action?: Action; type?: BlockType; color?: { kind: "text" | "background"; value: string | null }; trail?: string };
  const query = popup?.query.trim().toLocaleLowerCase() ?? "";
  const parentTarget=(action:string,target:BlockTarget):BlockTarget|null=>{
    if(action==='selectRow')return blockAncestor(editor,target,'columns');
    if(action==='selectColumn')return blockAncestor(editor,target,'column');
    return action==='selectItem'?listRowTarget(editor,target,actionItem.current):listSelectionTarget(editor,target,'list',actionItem.current);
  };
  const rootEntries: Entry[] = actions.filter(a=>{
    if(a==='comment'&&!comments)return false;
    if((a==='up'||a==='down')&&popup&&!canMoveBlock(editor,popup.target,a))return false;
    if(!a.startsWith('select'))return true;
    const next=popup&&parentTarget(a,popup.target);
    return Boolean(next&&popup&&!sameBlockSelection(popup.target,next));
  }).map((action) => ({ key: action, label: t(`actions.${action}`), glyph: action.startsWith('select')?'selectParent':action, action, group: action.startsWith('select')?-1:["turn", "color"].includes(action) ? 0 : ["comment","duplicate","copyLink","delete"].includes(action) ? 1 : ["addAbove","addBelow","copy"].includes(action) ? 2 : 3 }));
  const colorEntries: Entry[] = (["text", "background"] as const).flatMap((kind, group) => COLOR_NAMES.map((name) => ({ key: `${kind}-${name}`, label: t(`colors.${kind}`, { color: t(`colors.names.${name}`) }), glyph: "color", group, color: { kind, value: COLOR_VALUES[name] }, trail: t("actions.color") })));
  const conversions: Entry[] = types.map((type) => ({ key: `turn-${type}`, label: t(`blocks.${type}`), glyph: type, group: 6, type, trail: t("actions.turn") }));
  const catalog = popup?.kind === "color" ? colorEntries : [...rootEntries, ...(query ? conversions.concat(colorEntries.map((e) => ({ ...e, group: 7 }))) : [])];
  const actionMatches = catalog.filter((entry) => `${entry.label} ${entry.trail ?? ""} ${entry.type ? keywords[entry.type] : ""} ${entry.action ?? ""} ${entry.color ? entry.key : ""}`.toLocaleLowerCase().includes(query));
  const actionMenu = popup?.kind === "actions" || popup?.kind === "color";
  const count = actionMenu ? actionMatches.length : matches.length;
  const selected = Math.min(active, Math.max(0, count - 1));
  const pick = (type: BlockType) => {
    if (!popup) return;
    current.current.popup = null;
    if (popup.range) editor.commands.deleteRange(popup.range);
    const target = blockAt(editor, popup.target.pos, true);
    if (target) changeBlock(editor, target, type);
    onSlashUsed?.();
    setPopup(null);
  };
  const run = (action: Action) => {
    if (!popup) return;
    const target = blockAt(editor, popup.target.pos, true);
    if (!target) { close(); return; }
    if(action.startsWith('select')){
      const parent=parentTarget(action,target);
      if(parent)openActions(parent);
      return;
    }
    if (action === "comment") { comment(target); return; }
    if (action === "color") { setPopup({ ...popup, kind: "color", query: "", target }); setActive(0); return; }
    if (action === "copyLink") {
      const blockId = ensureBlockId(editor, target);
      const url = new URL(window.location.href); url.hash = new URLSearchParams({ block: blockId }).toString();
      void navigator.clipboard.writeText(comments?.blockLink(blockId) ?? url.href).then(() => setNotice(t("copied")), () => setNotice(t("copyFailed")));
      close(); return;
    }
    if (action === "turn") { setPopup({ ...popup, kind: "turn", query: "", target }); setActive(0); return; }
    if (action === "addAbove" || action === "addBelow") { addAdjacent(target, action === "addAbove"); return; }
    if (action === "copy") {
      void navigator.clipboard.writeText(target.node.textBetween(0, target.node.content.size, "\n")).then(() => setNotice(t("copied")), () => setNotice(t("copyFailed")));
    } else actOnBlock(editor, target, action as 'duplicate'|'delete'|'up'|'down');
    close();
  };
  const paint = (kind: "text" | "background", value: string | null) => {
    if (!popup) return;
    const target = blockAt(editor, popup.target.pos, true);
    if (target) {
      const key = `${target.node.attrs.blockId}/${kind}`, time = performance.now(), previous = colorChange.current;
      applyBlockColor(editor, target, kind, value, previous?.key !== key || time - previous.time > 750);
      colorChange.current = { key, time };
    }
    if (popup.kind !== "color") close();
  };
  const runEntry = (entry: Entry) => { if (entry.action) run(entry.action); else if (entry.type) pick(entry.type); else if (entry.color) paint(entry.color.kind, entry.color.value); };
  useEffect(() => {
    if (!editable) return;
    const refresh = ({ transaction }: { transaction: Transaction }) => {
      if (dismissed.current !== null && transaction.mapping.mapResult(dismissed.current).deleted) dismissed.current = null;
      setRevision((value) => value + 1);
      if (transaction.docChanged) setPopup((old) => {
        if (!old || old.range) return old;
        const mapped = transaction.mapping.mapResult(old.target.pos);
        let target = mapped.deleted ? null : blockAt(editor, mapped.pos, true);
        const id = old.target.node.attrs.blockId;
        if (id && (!target || target.node.attrs.blockId !== id)) {
          target = null;
          editor.state.doc.descendants((node, pos) => {
            if (node.attrs.blockId === id) { target = blockAt(editor, pos, true); return false; }
          });
        }
        return target ? { ...old, target } : null;
      });
      const { $from, empty } = editor.state.selection;
      const before = $from.parent.isTextblock ? $from.parent.textBetween(0, $from.parentOffset, "", "\n") : "";
      const opened = current.current.popup;
      if (opened?.inline && opened.range) {
        const from = transaction.mapping.map(opened.range.from, -1);
        const target = blockAt(editor, $from.pos);
        if ($from.parent.isTextblock && $from.start() === from && editor.state.selection.$to.parent.isTextblock && editor.state.selection.$to.start() === from && target) {
          setPopup({ ...opened, target, query: $from.parent.textContent, range: { from, to: $from.end() } });
        } else { current.current.popup = null; setPopup(null); }
        return;
      }
      const match = empty && !editor.isActive("codeBlock") && before.match(/^\/([^\n/]*)$/);
      let target = blockAt(editor, $from.pos);
      if (target && !["listItem", "taskItem"].includes(target.node.type.name) && $from.parent.isTextblock) target = { pos: $from.before(), node: $from.parent, parentType: $from.node($from.depth - 1).type.name };
      if (match && target) {
        const from = $from.pos - match[0].length;
        if (dismissed.current === from) return;
        setPopup((old) => old?.kind === "actions" || old?.kind === "turn" || old?.kind === "color" ? old : { kind: "insert", target, query: match[1], range: { from, to: $from.pos } });
      } else {
        dismissed.current = null;
        setPopup((old) => old?.range ? null : old);
      }
    };
    let frame=0;
    const reposition = (event:Event) => {
      if(event.target instanceof Node&&menuRef.current?.contains(event.target))return;
      if(!frame)frame=requestAnimationFrame(()=>{frame=0;setRevision(value=>value+1);});
    };
    editor.on("transaction", refresh);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      editor.off("transaction", refresh);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition);
    };
  }, [editor, editable, container]);
  useEffect(() => {
    if (comments?.identity !== "guest") return;
    let before = editor.getJSON() as ActivityNode;
    const track = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      const after = editor.getJSON() as ActivityNode, changes = changedActivityBlocks(before, after); before = after;
      if (!changes.length) return;
      const key = `relay-guest-block-activity-v1:${comments.pageId}`;
      const records = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, BlockActivityInfo>;
      const name = locale.startsWith("ru") ? "Гость" : "Guest", ts = new Date().toISOString();
      changes.forEach((block) => { records[block.id] = { createdBy: records[block.id]?.createdBy ?? (block.created ? name : null), createdAt: records[block.id]?.createdAt ?? (block.created ? ts : null), editedBy: name, editedAt: ts }; });
      localStorage.setItem(key, JSON.stringify(records));
    };
    editor.on("transaction", track); return () => { editor.off("transaction", track); };
  }, [editor, comments?.pageId, comments?.identity, locale]);
  useEffect(() => {
    setActivity(null);
    if (popup?.kind !== "actions" || !popup.target.node.attrs.blockId || !commentRequest.current) return;
    let cancelled = false; const blockId = popup.target.node.attrs.blockId;
    const refresh = async () => { try { const info = await commentRequest.current!<BlockActivityInfo | null>(`?blockActivity=${encodeURIComponent(blockId)}`); if (!cancelled) setActivity((old) => JSON.stringify(old) === JSON.stringify(info) ? old : info); } catch { /* Metadata does not block editing while offline. */ } };
    void refresh(); const timer = window.setInterval(refresh, 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [popup?.kind, popup?.target.node.attrs.blockId, comments?.pageId, comments?.identity]);
  useEffect(() => { setCommentDraft(null); setPopup(null); setPeople([]); }, [comments?.pageId, comments?.identity]);
  useEffect(() => { if (!editable) { setPopup(null); setHint(null); } }, [editable]);
  useEffect(() => { setActive(0); setHoverPreview(null); }, [popup?.query, popup?.kind]);
  useLayoutEffect(() => {
    if (!popup?.range) return;
    const dom=editor.view.dom;
    dom.dataset.editorSuggest='true';
    const from = editor.state.doc.resolve(popup.range.from).before();
    setBlockFilterHint(editor, { from, label: t("filterPlaceholder"),slash:!popup.inline });
    return () => {delete dom.dataset.editorSuggest;setBlockFilterHint(editor, null);};
  }, [editor, popup?.inline, popup?.range?.from, t]);
  useLayoutEffect(() => {
    const rect = hintRef.current?.getBoundingClientRect();
    if (rect) setHintSize((old) => old.width === rect.width && old.height === rect.height ? old : { width: rect.width, height: rect.height });
  }, [hint, revision]);
  useLayoutEffect(() => {
    if (!popup || !menuRef.current) return;
    const menu = menuRef.current;
    const scroll = menu.querySelector<HTMLElement>(".overlay-scroll-target");
    const naturalHeight = menu.offsetHeight + (scroll ? Math.max(0, scroll.scrollHeight - scroll.clientHeight) : 0);
    setMenuHeight(Math.min(popup.kind==='insert'?380:560, Math.ceil(naturalHeight)));
  }, [popup?.kind, popup?.query, count, revision, hoverPreview, activity]);
  useLayoutEffect(() => {
    if(!revealActive.current)return;
    revealActive.current=false;
    const row = menuRef.current?.querySelector<HTMLElement>(`[data-menu-index="${selected}"]`);
    const scroll = row?.closest<HTMLElement>(".overlay-scroll-target");
    if (!row || !scroll) return;
    const item = row.getBoundingClientRect(), viewport = scroll.getBoundingClientRect();
    if (item.top < viewport.top) scroll.scrollTop += item.top - viewport.top;
    else if (item.bottom > viewport.bottom) scroll.scrollTop += item.bottom - viewport.bottom;
  }, [selected, popup?.query]);
  useEffect(() => {
    if (!popup?.range) return;
    const dom = editor.view.dom;
    dom.setAttribute("aria-controls", `${id}-list`);
    dom.setAttribute("aria-activedescendant", `${id}-${selected}`);
    dom.setAttribute("aria-haspopup", "listbox");
    dom.setAttribute("aria-expanded", "true");
    return () => { for (const attribute of ["aria-controls", "aria-activedescendant", "aria-haspopup", "aria-expanded"]) dom.removeAttribute(attribute); };
  }, [editor, id, popup?.range, selected]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!editable) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "m" && comments) {
        event.preventDefault(); event.stopPropagation();
        const target = blockAt(editor, editor.state.selection.from);
        if (target) comment(target, { from: editor.state.selection.from, to: editor.state.selection.to });
        return;
      }
      if (event.key !== "Escape" && event.target instanceof Element && event.target.closest(".editor-custom-colors")) return;
      const { popup: open } = current.current;
      if (!open) {
        if ((event.ctrlKey || event.metaKey) && (event.key === "/" || event.code === "Slash")) {
          event.preventDefault(); event.stopPropagation();
          const target = blockAt(editor, editor.state.selection.from);
          if (target) openActions(target);
        }
        return;
      }
      if (open.inline && open.range && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault(); event.stopPropagation();
        editor.commands.setTextSelection(open.range);
      } else if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        if (open.range) dismissed.current = open.range.from;
        close();
      } else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        setHoverPreview(null);
        const step = event.key.startsWith("Page") ? Math.max(1, Math.floor((menuRef.current?.querySelector<HTMLElement>(".overlay-scroll-target")?.clientHeight ?? 180) / 30) - 1) : 1;
        const direction = event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1;
        const next = count ? event.key.startsWith("Page") ? Math.max(0, Math.min(count - 1, current.current.active + direction * step)) : (current.current.active + direction + count) % count : 0;
        current.current.active = next;
        revealActive.current=true;
        setActive(next);
      } else if (event.key === "Enter" || event.key === "Tab"&&open.kind==='insert'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (open.kind === "actions" || open.kind === "color") { if (actionMatches[Math.min(current.current.active, Math.max(0, count - 1))]) runEntry(actionMatches[Math.min(current.current.active, Math.max(0, count - 1))]); }
        else if (matches[Math.min(current.current.active, Math.max(0, count - 1))]) pick(matches[Math.min(current.current.active, Math.max(0, count - 1))]);
      } else if (event.key === "Tab") {
        if (open.range) dismissed.current = open.range.from;
        current.current.popup = null; setPopup(null);
      }
    };
    const menu = menuRef.current;
    editor.view.dom.addEventListener("keydown", keydown, true);
    menu?.addEventListener("keydown", keydown, true);
    return () => { editor.view.dom.removeEventListener("keydown", keydown, true); menu?.removeEventListener("keydown", keydown, true); };
  });
  useEffect(() => {
    if (!popup) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && (menuRef.current?.contains(event.target) || handlesRef.current?.contains(event.target) || (event.target instanceof Element && event.target.closest("[data-editor-menu-owner]")?.getAttribute("data-editor-menu-owner") === id))) return;
      if (popup.range) dismissed.current = popup.range.from;
      current.current.popup = null; setPopup(null);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [popup]);
  if (typeof document === "undefined") return null;
  if (!editable) return comments ? <BlockComments key={`${comments.identity}/${comments.pageId}`} editor={editor} context={comments} editable={false} anchor={null} onCloseDraft={() => {}} /> : null;
  void revision;
  const target = popup?.target ?? hovered;
  const nodeDOM = target ? editor.view.nodeDOM(target.pos) : null;
  const rect = nodeDOM instanceof HTMLElement ? nodeDOM.getBoundingClientRect() : null;
  const viewport = window.visualViewport;
  const vw = viewport?.width ?? window.innerWidth;
  const vh = viewport?.height ?? window.innerHeight;
  const geometry = target ? blockGeometry(editor, target) : null;
  const clip = editorClipRect(editor);
  const visible = geometry && geometry.top >= clip.top + 2 && geometry.top + 28 <= clip.bottom - 2 && geometry.left >= clip.left + 2 && geometry.left + 58 <= clip.right - 2;
  let width = Math.min(parseFloat(getComputedStyle(container.current??editor.view.dom).getPropertyValue('--editor-menu-width'))||280, vw - 24);
  const anchor = popup?.range ? editor.view.coordsAtPos(Math.min(popup.range.from, editor.state.doc.content.size)) : geometry && rect ? { left: rect.left, top: geometry.top, bottom: geometry.top + 28 } : null;
  const windowLeft = viewport?.offsetLeft ?? 0;
  const windowTop = viewport?.offsetTop ?? 0;
  const gripAnchor = geometry ? { left: geometry.left + 28, right: geometry.left + 54, top: geometry.top, bottom: geometry.top + 30 } : null;
  const controlLeft=gripAnchor?.left;
  const controlGap=geometry?.gap??10;
  const contextual = popup?.kind === "actions" || popup?.kind === "turn" || popup?.kind === "color";
  if(popup?.range)width=Math.min(320,vw-24);
  // Prefer available left space before flipping over the document.
  const wide=container.current?.dataset.editorLayout==='wide';
  const availableLeft=!wide||controlLeft===undefined?0:controlLeft-windowLeft-12-controlGap;
  if(contextual && availableLeft>=220)width=Math.min(width,availableLeft);
  const preferredLeft = contextual && gripAnchor && controlLeft!==undefined ? wide&&controlLeft - width - controlGap >= windowLeft + 12 ? controlLeft - width - controlGap : gripAnchor.right + controlGap : anchor?.left ?? windowLeft + 12;
  const left = Math.max(windowLeft + 12, Math.min(preferredLeft, windowLeft + vw - width - 12));
  const height = Math.min(menuHeight, popup?.kind==='insert'?380:560, vh - 24);
  const belowTop = (anchor?.bottom ?? windowTop) + 6;
  const aboveTop = (anchor?.top ?? windowTop) - height - 6;
  const upward = belowTop + height > windowTop + vh - 12 && aboveTop >= windowTop + 12;
  const preferredTop = contextual && gripAnchor ? gripAnchor.top - 18 : upward ? aboveTop : belowTop;
  const placementHeight=contextual?Math.min(560,vh-24):height;
  const top = Math.max(windowTop + 12, Math.min(preferredTop, windowTop + vh - placementHeight - 12));
  const previewLeft = left + width + 8 + 188 <= windowLeft + vw - 12 ? left + width + 8 : left - 196 >= windowLeft + 12 ? left - 196 : null;
  const previewType = !popup?.range && (popup?.kind === "insert" || popup?.kind === "turn") && hoverPreview && matches.includes(hoverPreview) ? hoverPreview : undefined;
  const hintButton = hint ? handlesRef.current?.querySelector<HTMLElement>(hint === "addTip" ? ".editor-block-handle:first-child" : ".editor-block-grip")?.getBoundingClientRect() : null;
  const hintCenter = hintButton ? (hintButton.left + hintButton.right) / 2 : (geometry?.left ?? 0) + (hint === "addTip" ? 12 : 38);
  const hintLeft = Math.max(windowLeft + 12, Math.min(hintCenter - hintSize.width / 2, windowLeft + vw - hintSize.width - 12));
  const hintBelow = (hintButton?.bottom ?? (geometry?.top ?? 0) + 28) + 8;
  const hintAbove = (hintButton?.top ?? geometry?.top ?? 0) - 8 - hintSize.height;
  const hintTop = hintBelow + hintSize.height <= windowTop + vh - 12 ? hintBelow : hintAbove;
  const editedPerson=people.find(person=>person.name===activity?.editedBy);
  const contextTarget=popup&&['listItem','taskItem'].includes(popup.target.parentType??'')?listSelectionTarget(editor,popup.target,'item')??popup.target:popup?.target;
  const showHandles=Boolean((controlsVisible||contextual)&&visible&&target&&geometry&&!popup?.range&&!editorControlsCovered({left:geometry.left,right:geometry.left+54,top:geometry.top,bottom:geometry.top+30}));
  const addCovered=Boolean(contextual&&geometry&&left<geometry.left+26&&left+width>geometry.left);

  return <>
    {ghost ? createPortal(<div className="editor-drag-ghost relay-editor" aria-hidden="true" style={{ left: ghost.left, top: ghost.top, width: ghost.width }}><div className="tiptap" dangerouslySetInnerHTML={{ __html: ghost.html }} /></div>, document.body) : null}
    <DropIndicator line={dropLine} />
    <OverlayPresence visible={showHandles} exitDuration={260}>{showHandles && target && geometry ? createPortal(<OverlaySurface surfaceRef={handlesRef} motionKind="controls" className="editor-block-handles" data-editor-menu-owner={contextual?id:undefined} data-menu-open={contextual||undefined} data-dragging={dragging || undefined} style={{ left: geometry.left, top: geometry.top }}>
      <button type="button" className="editor-block-handle" style={addCovered?{visibility:'hidden'}:undefined} aria-label={t("addTip")} aria-describedby={hint === "addTip" ? `${id}-hint` : undefined} onPointerEnter={() => setHint("addTip")} onPointerLeave={() => setHint(null)} onFocus={() => setHint("addTip")} onBlur={() => setHint(null)} onPointerDown={(event) => event.preventDefault()} onClick={(event) => {
        const currentTarget = blockAt(editor, target.pos, true);
        if (currentTarget) addAdjacent(currentTarget, event.altKey);
      }}><BlockGlyph type="add" /></button>
      <button type="button" className="editor-block-handle editor-block-grip" aria-label={t("dragTip")} aria-describedby={hint === "dragTip" ? `${id}-hint` : undefined} onPointerEnter={() => setHint("dragTip")} onPointerLeave={() => setHint(null)} onFocus={() => setHint("dragTip")} onBlur={() => setHint(null)} onPointerDown={(event) => onGripPointerDown(event, target)} onClick={(event) => { event.preventDefault(); if (event.detail === 0 && !dragging) openActions(target); }}><BlockGlyph type="grip" /></button>
    </OverlaySurface>, document.body) : null}</OverlayPresence>
    <OverlayPresence visible={Boolean(controlsVisible&&hint&&visible&&geometry&&!dragging&&!popup)}>{controlsVisible && hint && visible && geometry && !dragging && !popup ? createPortal(<OverlaySurface surfaceRef={hintRef} id={`${id}-hint`} role="tooltip" className="editor-handle-tooltip" style={{ left: hintLeft, top: Math.max(windowTop + 12, hintTop), maxWidth: Math.min(290, vw - 24) }}>{t(hint).split("\n").map((line, index) => <span key={index}>{line}</span>)}</OverlaySurface>, document.body) : null}</OverlayPresence>

    <OverlayPresence visible={Boolean(popup&&anchor)}>{popup && anchor ? createPortal(<div className="editor-menu-layer">
      <OverlaySurface surfaceRef={menuRef} blockLevel={80} owner={id} className="editor-block-menu" data-suggestion={Boolean(popup.range)} style={{ left, top, width, maxHeight: height }} onMouseDown={(event) => { if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLLabelElement) && !(event.target instanceof Element && event.target.closest(".editor-custom-colors"))) event.preventDefault(); }}>
        {!popup.range ? <input autoFocus className="editor-menu-search" role={actionMenu ? "searchbox" : "combobox"} aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={count ? `${id}-${selected}` : undefined} aria-label={t("search")} placeholder={actionMenu ? t("searchActions") : t("search")} value={popup.query} onChange={(event) => setPopup({ ...popup, query: event.target.value })} /> : null}
        {popup.kind==='actions'&&!query&&contextTarget?<div className="editor-menu-context">{['columns','column'].includes(contextTarget.node.type.name)?t(contextTarget.node.type.name==='columns'?'rowLabel':'columnLabel'):t(`blocks.${blockType(contextTarget.node,contextTarget.parentType)}`)}</div>:null}
        <OverlayScroll className="editor-menu-scroll">
          {query?<div className="editor-menu-group">{t('filteredResults')}</div>:null}
          <div id={`${id}-list`} role={actionMenu ? "menu" : "listbox"} aria-label={actionMenu ? t("blockActions") : t("insert")}>
            {count === 0 ? <div className="editor-menu-empty"><strong>{t("noMatches")}</strong><span>{t("tryAnother")}</span></div> : null}
            {actionMenu ? actionMatches.map((entry, index) => <div key={entry.key}>
              {!query && index > 0 && entry.group !== actionMatches[index - 1].group ? <div className="editor-menu-separator" role="separator" /> : null}
              {popup.kind === "color" && !query && (index === 0 || entry.group !== actionMatches[index - 1].group) ? <div className="editor-menu-group">{t(entry.color?.kind === "text" ? "colors.textHeading" : "colors.backgroundHeading")}</div> : null}
              <button id={`${id}-${index}`} type="button" role="menuitem" className="editor-menu-row" data-active={index === selected} data-danger={entry.action === "delete" || undefined} data-menu-index={index} onMouseEnter={() => setActive(index)} onClick={() => runEntry(entry)}>
                {entry.color ? <span className="editor-color-swatch" data-background={entry.color.kind === "background"} style={entry.color.kind === "text" ? { color: entry.color.value ?? undefined } : { background: entry.color.value ?? undefined }}>{entry.color.kind === "text" ? "A" : ""}</span> : <BlockGlyph type={entry.glyph} />}
                <span>{entry.label}{query && entry.trail ? <small className="editor-action-trail">{entry.trail}</small> : null}</span>
                {entry.action === "turn" || entry.action === "color" ? <span className="editor-menu-shortcut">›</span> : entry.action === "comment" ? <span className="editor-menu-shortcut">Ctrl+Shift+M</span> : entry.color && (popup.target.node.attrs[entry.color.kind === "text" ? "textColor" : "blockBackground"] ?? null) === entry.color.value ? <span className="editor-menu-shortcut">✓</span> : null}
              </button>
            </div>) : matches.map((type, index) => <div key={type}>
              {!popup.query && (index === 0 || type === "quote" || type === "prompt") ? <div className="editor-menu-group">{t(type === "quote" ? "formatting" : type === "prompt" ? "tools" : "basic")}</div> : null}
              <button id={`${id}-${index}`} type="button" role="option" aria-selected={index === selected} className="editor-menu-row" data-active={index === selected} data-menu-index={index} onMouseEnter={() => { setActive(index); setHoverPreview(type); }} onMouseLeave={() => setHoverPreview(null)} onClick={() => pick(type)}><BlockGlyph type={type} /><span>{t(`blocks.${type}`)}</span><span className="editor-menu-shortcut">{popup.kind === "turn" && blockType(popup.target.node, popup.target.parentType) === type ? "✓" : shortcuts[type]}</span></button>
            </div>)}
          </div>
        </OverlayScroll>
        {popup.kind === "color" ? <div className="editor-custom-colors"><div className="editor-color-target" role="tablist" aria-label={t("actions.color")}>{(["text", "background"] as const).map((kind) => <button key={kind} type="button" role="tab" aria-selected={colorTarget === kind} onClick={() => setColorTarget(kind)}>{t(kind === "text" ? "colors.textHeading" : "colors.backgroundHeading")}</button>)}</div><ColorField key={colorTarget} label={t("colors.custom")} value={popup.target.node.attrs[colorTarget === "text" ? "textColor" : "blockBackground"] ?? null} fallback="#6aabe4" resetLabel={t("colors.reset")} hexLabel="HEX" rgbLabel="RGB" hslLabel="HSL" pickLabel={t("colors.pick")} overlayOwner={id} onChange={(hex) => paint(colorTarget, hex)} /></div> : null}
        {previewType && previewLeft === null ? <div className="editor-menu-description">{t(`descriptions.${previewType}`)}</div> : null}
        {popup.kind!=='actions'?<div className="editor-menu-footer"><button type="button" onClick={() => (popup.kind === "turn" || popup.kind === "color") ? setPopup({ ...popup, kind: "actions", query: "" }) : close()}><span>{t((popup.kind === "turn" || popup.kind === "color") ? "back" : "close")}</span><span className="editor-menu-shortcut editor-menu-keys">{!popup.range?<><kbd>↑/↓</kbd><kbd>Enter</kbd></>:null}<kbd>Esc</kbd></span></button></div>:null}
        {popup.kind === "actions" && activity ? <div className="editor-menu-activity"><span>{t('activity.lastEdited')}</span><div className="editor-menu-editor">{editedPerson?.avatarUrl?<img src={editedPerson.avatarUrl} alt=""/>:<span className="editor-menu-editor-avatar" aria-hidden>{activity.editedBy.slice(0,1)}</span>}<span>{activity.editedBy}</span></div><DateLabel value={activity.editedAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.editedAt))}</DateLabel></div> : null}
        {popup.kind === "actions" ? <div className="editor-menu-stats">{t("stats", { words: popup.target.node.textContent.trim().split(/\s+/).filter(Boolean).length, characters: popup.target.node.textContent.length })}</div> : null}
      </OverlaySurface>
      {previewType && previewLeft !== null ? <aside className="editor-block-preview" style={{ left: previewLeft, top: Math.max(windowTop + 12, Math.min(top, windowTop + vh - 222)), width: 188 }}><BlockPreview type={previewType} /></aside> : null}
    </div>, document.body) : null}</OverlayPresence>
    {comments ? <BlockComments key={`${comments.identity}/${comments.pageId}`} editor={editor} context={comments} editable={editable} controlsVisible={controlsVisible} onPeople={setPeople} onAddComment={(target) => { if (target) comment(target, null); }} anchor={commentDraft} onCloseDraft={() => setCommentDraft(null)} /> : null}
    {notice ? createPortal(<div className="editor-tools-notice" role="status">{notice}</div>, document.body) : null}
  </>;
}
