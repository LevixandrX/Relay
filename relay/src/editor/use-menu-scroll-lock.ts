import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
const menuOwners=new Set<symbol>();
function syncMenuOwners(){const open=menuOwners.size>0;document.documentElement.classList.toggle('editor-block-menu-open',open);window.dispatchEvent(new CustomEvent('relay:editor-menu-state',{detail:{open}}));}
export function useMenuScrollLock(editor: Editor, open: boolean, menu: RefObject<HTMLDivElement | null>, overlayOwner?: string) {
  const locked = useRef<{ element: HTMLElement; top: number; left: number }[]>([]);
  const owner=useRef(Symbol('editor-menu'));
  useLayoutEffect(()=>{if(!open)return;const key=owner.current;menuOwners.add(key);syncMenuOwners();return()=>{menuOwners.delete(key);syncMenuOwners();};},[open]);
  useEffect(() => {
    if (!open) return;
    const ports: { element: HTMLElement; top: number; left: number }[] = [];
    for (let element = editor.view.dom.parentElement; element; element = element.parentElement) {
      const scrollable = element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
      if (!scrollable || (!/auto|scroll/.test(getComputedStyle(element).overflowY) && element !== document.scrollingElement)) continue;
      ports.push({ element, top: element.scrollTop, left: element.scrollLeft });
    }
    locked.current = ports;
    const prevent = (event: Event) => {
      if (event.target instanceof Node && (menu.current?.contains(event.target) || (Boolean(overlayOwner) && event.target instanceof Element && event.target.closest("[data-editor-menu-owner]")?.getAttribute("data-editor-menu-owner") === overlayOwner))) return;
      event.preventDefault();
    };
    const freeze = () => { for (const port of ports) { if (port.element.scrollTop !== port.top) port.element.scrollTop = port.top; if (port.element.scrollLeft !== port.left) port.element.scrollLeft = port.left; } };
    document.addEventListener("wheel", prevent, { passive: false, capture: true });
    document.addEventListener("touchmove", prevent, { passive: false, capture: true });
    document.addEventListener("scroll", freeze, true);
    return () => {
      locked.current = [];
      document.removeEventListener("wheel", prevent, true); document.removeEventListener("touchmove", prevent, true); document.removeEventListener("scroll", freeze, true);
    };
  }, [editor, open, menu, overlayOwner]);
  return useCallback(() => { for (const port of locked.current) { port.top = port.element.scrollTop; port.left = port.element.scrollLeft; } }, []);
}
