# Development guide (for humans & AI agents)

Rich editor: `node node_modules/tsx/dist/cli.mjs tests/rich-blocks.ts` checks insertion constructors, content preservation, AST/API roundtrips, atomic slash conversion/undo, table merges/splits, URL/math rules. `tests/page-assets.ts` uses an isolated database to verify uploaded bytes, roles, page isolation and current-publication references. Run `npm run db:migrate` for the additive `page_assets` table. Build web and desktop; TableKit/KaTeX/Lowlight come from the parent package.

`tests/public-rich-blocks.tsx` checks server-rendered rich blocks, public media URLs and heading anchors. The rich-block tests include completely covered table rows after merging cells.

Browser checks: accept suggestions with Enter and Tab, type immediately, undo and reload. Tab navigates table cells and appends a final row; saved cell selections drive merge/split. Closed toggles retain content and Enter in the title creates a sibling; an open title enters the body. Test upload/replace/caption/width/reload, downloads, media playback, PDF, provider embeds, equations, live contents navigation and page links. Use actual styles in columns, narrow widths, light/dark and Frost. Check read-only/public separately.

## Repo root

Application lives in `relay/`. Parent repo may contain wrapper scripts.

## Before coding

1. Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and this file.
2. Any UI change: read `docs/DESIGN_PRINCIPLES.md` first. Prefer quieter, more native desktop — not AI-SaaS polish.
3. For Next.js APIs, prefer `node_modules/next/dist/docs/` over training data (see root `AGENTS.md`).
4. Keep changes tenant-safe: never fetch a page without membership join.

## Запуск (важно)

Рабочая папка приложения: **`relay/`**.

```bash
cd relay
npm run db:migrate
npm run dev          # сайт http://localhost:3000 (сам освобождает порт)
```

### Windows — один ярлык (веб + десктоп)

После клона с GitHub:

```powershell
# из корня репозитория
powershell -File scripts/setup-windows-dev.ps1
```

На рабочем столе появится **Relay.lnk** — API + браузер + окно десктопа (live UI через `tauri:dev`).

Переустановить только ярлык:

```powershell
cd relay
npm run relay:shortcut
```

Запуск вручную:

```powershell
cd relay
npm run relay:start
```

Заранее собранный `relay_desktop.exe` **вшивает** UI и **не** подхватывает Vite — для разработки используй ярлык / `relay:start`.

Опционально release-exe: `powershell -File scripts/start-desktop.ps1 -Rebuild`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Старт + авто-освобождение порта 3000 |
| `npm run dev:clean` | То же + очистка `.next` |
| `npm run db:migrate` | Схема SQLite |
| `npm run build` / `npm start` | Прод-сборка и запуск |
| `npm run relay:start` | Windows: API + браузер + десктоп |
| `npm run relay:shortcut` | Ярлык Relay.lnk на Desktop |
| `npm run desktop:dev` | UI десктопа (Vite, :1420) |
| `npm run desktop:tauri` | Нативное окно Tauri 2 |
| `npm run desktop:build` | Сборка десктоп-приложения |

Десктоп: `desktop/` — см. `desktop/README.md`. Стек: Tauri 2 + React + Vite.

Shared web modules are imported via aliases in `desktop/vite.aliases.mjs`. Vite does **not** read `tsconfig.json` paths — a missing entry there is a runtime failure. Keep that file in sync with `desktop/tsconfig.json` `compilerOptions.paths`.

## GitHub Releases (опционально)

Тег `v*` запускает CI и прикрепляет Windows `.exe`/`.msi` к Release — для тестеров без dev-окружения.  
Основной путь для команды: clone + `setup-windows-dev.ps1` + ярлык.

## Env

Variables are read from `relay/.env.local` (see `.env.example`).

Minimum: `AUTH_SECRET` (32+ chars). Optional: OAuth keys, `OPENAI_API_KEY`, `DATABASE_URL`, `CORS_ORIGINS`.

Desktop cloud: start API (`npm run dev`), then desktop with `VITE_API_URL=http://127.0.0.1:3000`.

## Conventions

`node node_modules/tsx/dist/cli.mjs tests/block-move.ts` exercises row/item/list moves in bullet, numbered and task lists: same-level siblings, nested boundary lifts, root exits, exact undo and API-valid ASTs. Availability must use the same planner as execution, with unavailable Move actions omitted. Browser QA must include an expanded Frost discussion over actual editor text, including a backdrop-root ancestor on the editor, not only stripes on the page background; check hover occlusion, wheel chaining, clipped document scroll and compact indicators after resize.

Editor regression checks: `node node_modules/tsx/dist/cli.mjs tests/editor-layout.ts` covers columns, moving blocks, stable IDs, indentation and Undo. `node node_modules/tsx/dist/cli.mjs tests/comments-domain.ts` checks comments, layout persistence, block activity and access permissions in an isolated temporary database.

`node node_modules/tsx/dist/cli.mjs tests/comment-drafts.ts` checks independent discussion drafts, account/page isolation, recovery and side-drop activation distances.

`node node_modules/tsx/dist/cli.mjs tests/comment-layout.ts` checks discussion stack collisions, active-card alignment and the scroll delta needed to reveal a card. UI regression checks should cover multiple threads on one block, bounded history with a fixed composer, partial visibility, Normal/Compact/Zen widths and inline layout on narrow screens; emoji checks include custom-tab addition, image replacement and press-and-hold preview without an accidental reaction.

`node node_modules/tsx/dist/cli.mjs tests/page-resume.ts` checks block-relative caret recovery after reordering, deletion and shortening, account/page key isolation and corrupt storage. Browser checks should use the real web/desktop CSS entrypoints, test collapsed and expanded comment contents, first composer geometry, and reopen/reload a long page while verifying both viewport and caret. A new account/page starts at the beginning; a direct block/comment link takes priority over the stored position.

`node node_modules/tsx/dist/cli.mjs tests/comment-time.ts` checks compact EN/RU timestamps, the week boundary, older years and invalid dates. Discussion UI checks also cover initial history-at-bottom, the latest-message jump, own replies keeping the thread open, message-only toolbar visibility, portal menu geometry/keyboard controls, reaction previews, neutral first-composer focus, continuous emoji categories, custom grid alignment and Cancel/Escape clearing uploaded images. Use narrow pages when checking inline space redistribution and sample animation frames with actual CSS entrypoints rather than a reordered test stylesheet.

`node node_modules/tsx/dist/cli.mjs tests/activity-time.ts` checks compact chrome vs long Activity timestamps and absolute date boundaries. For interaction regressions, use native pointer press/release (DOM `.click()` misses focus capture): actions and emoji buttons on collapsed discussions must open their popup without expanding history. Also check full ordinary names/ellipsis for long names, timestamp hover/focus, the dedicated annotation gutter in all chrome modes, collapsed-card wheel chaining, horizontal trackpad drift, long Activity previews staying clear of the rail, profile hover and page-title navigation.

Editor layout checks include all chrome modes at 600/1000/1280/1600/1920px, a 720px maximum text measure with adaptation to the effective CSS viewport, bounded annotations with clear hover gaps, and no commented-block text padding. Move the pointer away while message actions/emoji/custom upload remain open: both the card and its text anchor must stay highlighted. Drag menus retain their source + and Drag; the Zen navigation edge must remain disabled until closing. With navigation revealed, controls may not cover it. Verify selected/colored/quoted blocks at multiple radius/blur values; only the paint layer should own the rounded contour, and the quote's vertical rule must stay straight.

- Server-only DB imports in Route Handlers / Server Components
- Zod at every API boundary
- Soft-delete pages (`deleted_at`)
- UI copy: short, human, no jargon in empty states


Run node node_modules/tsx/dist/cli.mjs tests/page-layout.ts for a physical 1920px display at 100/125/150/175/200% Windows scale. Browser checks must set the corresponding CSS viewport (1920/1536/1280/1097/960px) and deviceScaleFactor, not use 1920 CSS pixels for every scale. Verify wide layout has a 720px text measure, annotations to the right and Drag menu immediately left of Drag; narrow layout keeps the available text width, count indicators and a menu over the text to the right of Drag; include fractional-coordinate rounding and a larger root font. Editor paragraph font remains regular 15px, while deliberate heading/bold formatting is preserved.

Editor controls regression: run tests/editor-controls.ts, tests/page-layout.ts and tests/block-indent.ts with tsx. In the browser, cross the 75/25 pointer boundary, scroll without moving the mouse, open both page/editor menus, resize columns, and use Tab / Shift+Tab plus Enter in ordinary text, lists and code. Typing and scrolling hide controls until fresh pointer movement. A block action menu retains its own +/Drag above the shield; other page controls and add-comment remain suppressed. Slash suggestions keep editor focus and a visible caret through filtering, selection and dismissal.

Verify nested item targeting by crossing from each text line to its grip: a previous item's bridge must not capture the next line, and the enclosing list must not become a second hover target. Drag remains highlighted while its menu is open; an overlapped + stays behind the menu. On either side the grip/menu gap must equal the measured grip/source-paint gap. List and item selection actions update the selected node while keeping the menu open; switching back from the whole list restores the original item. Insertion catalogs are limited to 380px, scroll internally and show a localized filtered-results heading. Enter and Tab both accept insertion suggestions; native Enter including its text event must not create an extra line, and subsequent typing must stay in the chosen block. Check Appearance transparency and blur on comment cards, retained paint on tiny columns, and uniform selected-block paint beside an open menu.

Controls regression must include the real chrome ActivityDisclosure: its hover dialog stays mounted with aria-hidden=true after closing. Verify +/Drag/add-comment remain usable with this hidden portal and inside a containing page dialog; visible unrelated menus still suppress them. At intermediate canvas widths, preserve 720px text plus 288px discussions by using the left gutter; only the Drag menu flips right when it cannot fit left.

List selection checks: with one root item containing nested items, Drag already covers the list, so Select entire list is absent. Select list item selects only the item's own text block and marker; descendants remain unselected. Reopening actions retains that scope and omits Select list item. A leaf item also omits the redundant row action. Repeat for bullets, numbered lists and checklists, comparing painted bounds before and after group selection. For Frost, place a high-contrast stripe pattern beneath an actual inline discussion and a portaled menu: both must blur it with the same Appearance parameters, and disabling blur must reveal the pattern. Checking computed blur alone does not verify backdrop sampling.

`tests/table-cell-actions.ts` covers one/rectangular cell selection, text/background colors, merge/split, clear and undo. `tests/editor-controls.ts` covers equal left gutter reach at multiple indents and nested-row priority. Browser QA must use the production stylesheet entrypoint, verify language scrolling from mouse and keyboard, direct outside access to table edge controls, cell grip menus, custom emoji creation from Callout, stable anchors and a large set of discussions scrolling with no positional drift on Frost.

Editor follow-up checks: tests/table-interactions.ts includes live multi-step resize/reorder undo grouping; tests/table-cell-actions.ts checks clearing both colors and text, including empty-cell action availability. Browser QA must also cover three-line caret → another row's Drag → Escape → typing, page A/B return and reload with nested overflow containers, side submenu Arrow/Escape, picker cancel/ask-color, row/column mouse reorder, corner resize and frame alignment during scroll. Build web/desktop and cargo check when changing the native code saver.

`tests/table-range.ts` covers grouped row/column drops, merged-unit boundaries, attribute/ID/width preservation and single-step undo. In browser QA, verify that source geometry/colors stay intact and source text hides until drop; order must stay unchanged during the gesture. Resize the last column without redistributing earlier columns, expand beyond the prose width, and horizontally scroll with the touchpad/shared rail. Verify Callout Upload Cancel/Back and optional library save, reaction child-form Cancel/Back without dismissing the main picker, and Activity → profile. Confirm real caret focus by typing immediately after menu dismissal, page return and reload.

`tests/page-save-queue.ts` checks ordered acknowledged versions, page isolation, failure recovery, rail bounds and tooltip anchors. `tests/page-save-persistence.ts` uses its own temporary database and real page/metadata domain calls to verify concurrent table edits persist, creation/edit metadata is recorded, and stale external writes still return 409. Test the desktop BlockEditor inside the real outer OverlayScroll; a plain editor harness misses its horizontal-wheel boundary. Sample the drag copy during the gesture: computed fixed positioning and viewport coordinates matter, not just final row order. Check empty-icon hit testing, Ctrl+V immediately after opening custom emoji, Right/Left navigation, trailing add-column clearance and active discussion/table non-overlap at a wide breakpoint.

`tests/editor-followup.ts` checks picker end alignment, viewport fallback/flip and row/column preview bounds for grouped sizes. Browser regression: Color → Right → Left → Up leaves one highlight; hover submenu → leave both menus → Down/Escape still works. Paste immediately on Upload/custom emoji without focusing a name input; test a short viewport and the explicit Paste button. Change an icon while the caret is far away, then type immediately. While editing a wide table collapsed cards move below it, but clicking annotated text never scrolls to its discussion. Drag a column diagonally/outside and a row sideways/outside: copies stay within the table and along one axis with the blue handle and no tooltip. Switch column selection to a row drag without moving all rows. Check partially clipped +/Drag and a partially visible trailing + with a working tooltip/click. Resize the browser while prose width stays constant; the table scrollport must still reach the workspace edges.

`tests/editor-polish.ts` covers partial/offscreen selection geometry, exclusive table edge intent, discussion collision avoidance after packing and localized emoji labels. UI regression: select and scroll out/back; apply text/background color; approach Callout rows from the right gutter and pass their gaps without a parent-header jump; check 34px color controls and bounded tooltips at a narrow breakpoint. Hover table controls without focusing a cell, enter the final cell vertically/horizontally, and open Drag on an overflowing table. Verify code insets at start/middle/end of horizontal scrolling. Test Frost with contrast text/stripes behind discussion cards, not just computed CSS.

`tests/rail-drag.ts` verifies frame coalescing, final-pointer flush, clamping and cancellation. Add a long colored paragraph behind a discussion for blur QA: a pseudo-element/stripe-only background does not reproduce a filtered parent scroll-container bug. Compare 80%/16px and Frost against compact popovers, including an expanded card. Verify the outer page keeps its glass and native annotation scrolling. At the final table cell, small alternating pointer movements must keep one edge, and deliberate horizontal/vertical travel changes it. Check the formatting More menu after its source button unmounts; its position must remain beside the panel.

Selection QA: compare a paragraph, Callout, code with/without caption, divider, list row, toggle, equation and 50%/100% media. The contour must follow the visual frame, retain equal rim thickness, fade on both selection and deselection, and respect reduced motion and Appearance radius. A media frame without a caption must not include the hidden toolbar's empty height. Approach its Comment from the common page gutter and verify handles stay beside the actual media edge. Tables retain their full-width clipped paint instead of a rounded text-measure rectangle.
