# Architecture

> Полное ТЗ и запреты: **[SPEC.md](./SPEC.md)**. Этот файл — краткая карта стека и границ.

## Stack (сетевой бэкенд и БД)

| Layer | Choice | Notes |
|---|---|---|
| **Backend (HTTP API)** | **Next.js 16** App Router, TypeScript | Route Handlers `/api/v1/*` — отдельного сервиса нет |
| **Database** | **LibSQL** (file) + **Drizzle ORM** | Локально `file:./data/relay.db`; позже Neon Postgres |
| Web UI | React 19 + CSS tokens (`globals.css`) + next-intl (ru/en) | |
| Desktop | Tauri 2 + React/Vite | Тот же API по HTTP + Bearer; те же `messages/*.json` |
| Editor | TipTap (ProseMirror) | Документ = JSON AST |
| Canvas | Quickdraw | Snapshot JSON + WS relay for live edits |
| Auth | `jose` JWT + таблица `sessions` | Cookie (web) или `Authorization: Bearer` (desktop) |
| Billing | `subscriptions` + entitlements | Free / Pro trial 14d |
| Validation | Zod | API + document AST |

## Request path

```
Browser / Tauri
  → /api/v1/...
  → requireSession / requireWorkspaceAccess
  → domain/* (tenant-scoped)
  → Drizzle → LibSQL
  → optional audit_logs
```

## Module boundaries

```
src/
  app/           # тонкие routes + UI pages — без тяжёлой бизнес-логики
  domain/        # auth, access, pages, workspaces, billing, prompts
  db/            # schema + migrate + client
  editor/        # TipTap
  lib/           # session, cors, errors, rate-limit, ids
  components/    # UI chrome
desktop/         # shell; cloud через API; guest — local store
```

**Правило:** логика «можно ли?» и «как сохранить?» живёт в `domain/`, не в кнопках.

## Editor layout

Shared `editor/block-columns.ts` registers `columns` / `column` AST nodes for web and desktop, using the same child limit and width bounds as domain validation. Side drops create columns, including between existing columns; the drop threshold adapts to the gap. Separators preview relative widths once per animation frame without mutating editable DOM attributes, then commit one transaction on release (Escape cancels). `blockIndent` stores horizontal offsets in 24px steps. Tab / Shift+Tab indent/outdent the current block or selected blocks, nest/lift list items, and indent code lines without leaving the editor. Layout is saved with page content and rendered on public pages; it does not introduce a separate layout store. Dragging, resizing and undo preserve block IDs and comment anchors.

Moving into columns resets the page-level block offset. Existing column content is rebased to its minimum direct-child indent, preserving relative nesting while keeping a common left origin. Indents are bounded by available column width and overflow cannot paint into the next column. Relative flex weights are scaled so even sums below one fill the row. Only the hovered/focused or dragged separator is visible; its subpixel position follows a short frame-based settling motion, including on release. Reduced motion uses direct positioning.

Outer row separators edit `layoutStart` / `layoutEnd` workspace fractions without changing the individual column weights. They share the existing transaction/undo and page-save path, support arrow keys and Escape, and never extend behind navigation. Public `ColumnRowView` applies the same bounded edge calculation. The block action menu explicitly selects an enclosing column, columns row or list; these containers have block identities, so selection, dragging, colors and discussions use the same operations as ordinary blocks. Up/down at a column boundary moves its block before/after the row instead of disabling the action.

List levels use a recurring disc/circle/square or decimal/alpha/roman cycle. A group color operation clears redundant descendant colors in the same undo transaction; a presentation decoration suppresses duplicate inherited paint in older documents. Each list item remains independently selectable, movable and commentable. Task item node views are styled by their actual parent/checkbox structure, without relying on a missing `data-type` attribute.

Column paint padding follows the measured gap, leaving clear space between adjacent surfaces, including narrow columns. List-item paint includes the marker with a compact gutter; handle targeting uses the item's own text height rather than its nested subtree. Block paint layers do not sample a blurred backdrop, avoiding seams and menu-related compositing artifacts. Discussion surfaces use the same Appearance opacity, blur and radius tokens as other overlays.

Hover controls target list items; list containers become targets through explicit group selection. Selecting a list uses its outermost list ancestor, remembers the source item by block ID and updates its NodeSelection while keeping the action menu open. Menu placement shares the actual gap between Drag and the source paint. Block conversion explicitly restores a text selection inside the inserted block; insertion suggestions consume Enter/Tab before editor keymaps can split or indent it.

Selecting a list row uses a NodeSelection on its own text block, excluding nested lists; presentation decorations extend that surface over the marker/checkbox. A single-child list wrapper is equivalent to its item for action visibility. Redundant selection actions are omitted, and list-container paint aligns with the item's existing edges. Handles retain the selected row scope when reopening actions. Discussion glass lives on an independent card pseudo-element, while the animated host has layout containment without a backdrop filter; nested message tools can then sample the page correctly instead of an ancestor backdrop root.

## Comment presentation

Discussion annotations render through a body portal with an overflow-clipped viewport and a document-relative inner canvas. This shares the popup compositing root, avoiding editor ancestors that restrict backdrop sampling. The canvas follows the source scrollport; block anchors, packing and page-owned bottom space remain in the editor. No clip-path, opacity animation or backdrop filter is applied to the portal ancestors. Controls behind an annotation are occluded. Directional block moves use one schema-valid transaction planner for both command availability and execution, including list-row/item boundaries and column exits.

Shared editor components render unresolved discussions in a body portal whose inner annotation canvas follows the document scroll content. Cards follow their block anchors without viewport pinning; on narrow pages, message-count indicators open bounded discussion popovers. Per-discussion composer drafts are transient UI state, scoped by actor/page and restored from session storage in the same tab. Sent cloud comments still use the authenticated comment API and domain permissions; drafts never create comments or notifications. Blank page margins map clicks to the nearest editor text position without increasing line width.

Hovering a source block/range and hovering its discussion share the visual highlight. Source hover or activation can elevate a displaced discussion to its anchor; a short grace interval covers the gap from text to card. Expanded column rows are annotation obstacles: idle cards move below overlapping rows, while the active source may raise its card over them. `CommentCard` interpolates those placements with its existing compositor animation; comment anchors and storage remain unchanged.

Discussions on the same block stack in creation order, with unsent discussions after existing threads. Activating a card shifts the stack toward its anchor, animates neighboring positions, and reveals it within the document scroll port. Expanded history is height-limited with the shared scrollbar; the composer stays outside that internal scroll. Focus on message actions, reactions, profiles, editing controls or timestamps does not activate/expand a card. An open message menu/emoji picker (including custom upload) holds the linked card and text anchor in their hover presentation until it closes. The inline add-comment control occupies the independent gutter between the document and annotations, hidden on blocks with an unresolved discussion/draft and wherever a neighboring card would cover it. Card widths follow the CSS viewport (312px on wider windows, 288px on smaller effective widths); 48–80px gutters retain space during hover/focus transforms.

Page text uses a regular 15px system font and a 720px maximum measure across chrome modes. Shared editor/page-layout.ts calculates width and offsets from the actual CSS viewport and canvas content box, keeping the full 720px measure and right annotation column whenever the canvas can fit them. Intermediate widths shift text toward the left control gutter; the transient menu does not decide whether discussions fit. Smaller canvases use a centered text measure with count indicators. The calculation includes a rounding allowance for fractional coordinates. Controls use a separate left gutter rather than padding inside the text column; commented blocks do not reserve obsolete indicator padding. Normal positions the document with its annotation area, while Compact/Zen center the text column within the canvas. Wide canvases reserve a readable text measure (720px) and a separate 288px annotation column. Narrow canvases use per-block message-count indicators (capped at 9+) and reserve a right gutter; existing discussion cards never fall below the text. The layout threshold is monotonic as the available canvas grows, including Windows DPI scaling. useEditorCanvas publishes the resulting CSS variables and annotations-side state, and signals geometry changes without modifying document content. Comment placement consumes this same decision rather than applying a second independent threshold. CommentBlockPopover groups every visible thread belonging to the indicated block, with root quotes, separators and independent persistent composers. It is a bounded, nonmodal portal using the shared OverlayScroll, theme tokens, history jump helper and existing message controls. The popover is at most 420px wide/high and fits the available space below its source, flipping above near the lower edge. The count indicator opens all block threads centered in the visible workspace and focuses the last composer. Clicking a marked text range opens only its thread, centered on that range, while keeping the editor caret; wide mode likewise expands the card without focusing its composer. Overlapping quotes choose the smallest saved range at the click position. Comment selection and composer focus are separate states. Composer tools appear on focus, and popup placeholders use Add a comment. First composers wait for card placement before programmatic focus; explicit focus requests can reopen an existing draft. Programmatic focus restores the saved per-draft caret/selection (defaulting to the end), while pointer clicks keep their native caret position. Multiline text spans the entire field with tools below. An animated Cancel shelf shares the field border, background and lower corners; it removes draft text/references/files and invalidates in-flight image/file preparation. Message/composer actions have themed hover transitions and accessible delayed portal tooltips. Focused composers (including new drafts from Drag) are revealed within the popup scroll port. Escape from the source text keeps the editor focus; otherwise it returns to the indicator. Outside clicks keep their target focus. Resizing preserves drafts and an active reply. Rounded highlight contours belong to the expanded pseudo-element paint surface; ordinary text nodes retain a square, isolated layout box, avoiding a second contour at the left edge. Quote rules remain independent.

Block menus independently use the actual left gutter: 240–280px menus fit immediately left of Drag when possible, otherwise they overlay text on its right. Side discussions can stay visible in either case. Page layout reserves the Drag offset, reclaiming the former + gutter. Frequent actions (comment, duplicate, link and delete) precede insertion/copy/reordering actions; a viewport-bounded menu height up to 560px keeps them visible. The root menu has a compact Last edited section with author/avatar, exact-date hover and word/character counts. Only implemented shortcuts are displayed, with + between modifiers. Menu scroll never repositions document handles or rerenders the editor geometry; keyboard navigation alone reveals its active item. Overlay rail metrics are coalesced per animation frame and vertical scroll does not remeasure every child. `useMenuScrollLock` tracks menu owners and exposes `editor-block-menu-open` / `relay:editor-menu-state`; Zen navigation edge/peek stays disabled while a block menu is open. The editor clipping calculation includes visible floating sidebars, and handle hit testing hides controls over navigation. Portaled handles render below navigation panes as a second guard.

Opening a discussion starts at its latest message. Reading older messages exposes a bounded-duration jump to the bottom; wheel/pointer/keyboard input interrupts that scroll. New incoming replies follow only if already at the bottom, while the user's own sent reply is revealed and keeps the discussion open. Position transitions use independent `translate` animations alongside hover `transform`; height transitions use the previous measured height (or current interrupted animation height). Layout measurements are coalesced per animation frame and run only for relevant data/geometry changes. The `relay:comment-layout` transaction meta signals inline space changes, including changes whose total document height stays the same. Message menus and reaction previews are portals with appearance tokens; the menu supports keyboard navigation and never affects history dimensions.

Emoji categories share one scroll port, with category navigation jumping to section anchors and manual scrolling updating the active category. Custom addition is the first grid cell. Cancel/Escape invalidate asynchronous image preparation and clear its image/name; a successful upload returns to the custom section. `lib/display-time.ts` centralizes compact localized timestamps (including Russian 5д/21ч), compact Activity chrome labels, and long Activity panel labels. Calendar dates use Intl/CLDR locale month abbreviations and ordering; `components/DateLabel.tsx` shows exact timestamps in a themed portal on hover/focus. Author labels stay adjacent to their timestamp, with only genuinely overflowing names ellipsized and their full names retained in the label/profile.

Shared vertical OverlayScroll rails suppress horizontal wheel drift, reset scrollLeft, and disable insignificant overflow (up to 2px). Collapsed discussion history always passes wheel scrolling to the document; expanded history retains vertical scrolling with boundary chaining. Activity update rows use border-box sizing and wrap long changes inside the scrollbar gutter, avoiding oversized rows and highlights across the rail. Update titles navigate through the existing page/board events; avatars reuse the comment profile presentation.

## Multi-tenancy

Page resume is shared UI logic in `editor/use-page-resume.ts`, with validated local records and block-relative caret helpers in `editor/page-resume.ts`. Web and desktop use the existing account/page identity. It restores the actual document scroll port during layout, follows block IDs across reorders, preserves offsets through layout changes during a bounded settling period, and yields immediately to user input or explicit focus targets. Storage failures do not prevent editing; no API calls or document revisions are created. Page shells mount the editor only once the matching page content is ready. Equivalent schema-normalized documents do not trigger `setContent`, which would otherwise reset a restored caret.

Comment history overrides the shared scrollbar's zero flex basis with selectors scoped to the card content. Keep these overrides more specific than the base `.overlay-scroll` rules: `overlays.css` imports editor tools before its own scrollbar rules. UI checks must use the real stylesheet entrypoints, rather than importing tools last.

На доменных строках есть `workspace_id`. Доступ только через membership join.  
Нет membership → **404** (не светим существование ресурса).

## Auth sketch

- Web: HttpOnly cookie `relay_session`
- Desktop: Bearer после login / OAuth pairing
- JWT содержит `sub` + `jti`; строка в `sessions`; logout → `revoked_at`
- OAuth providers: google, github, yandex (vk отложен)

## Security baseline

См. SPEC §3–4. Кратко: RBAC, отзываемые сессии, CORS allowlist, no JWT-in-URL, claimSecret для desktop pair, CSP в Tauri.

## Environments & evolution

- Local DB: LibSQL file  
- Prod DB: **не зафиксирована** (Postgres — кандидат; выбор после MVP, см. SPEC §1.1)  
- **Не тащить Redis/микросервисы по умолчанию.** Сначала закрыть MVP на текущем стеке, потом эволюция слоёв целиком.

Editor controls follow pointer zones: +/Drag occupy the first 75% of each block and 24px beyond the left controls; add-comment occupies the remaining 25% and 24px beyond its button. Column groups have no inline add-comment button; the block menu and text selection can still create discussions. Compact comment indicators aggregate every discussion/draft in the outer column group into one row counter (9+ cap), without changing their stored block anchors. The row popover contains all those discussions; a highlighted text click still opens only that text's thread and keeps editor focus. Page scrolling suppresses controls until fresh pointer movement after scroll settles. A shared presence transition fades controls in/out; visible menu/dialog surfaces suppress them, including page menus. Hidden/aria-hidden surfaces (notably the always-mounted Activity hover) and the containing page dialog do not suppress an editor. Column separators use a neutral 4px rule, col-resize cursor, 24px hit target and individual hover/focus fades.
