## Why

Every job that needs a booklet also needs a few pages gone: a cover sheet the
printer added, a scanned blank verso, a licence page, the back matter nobody
wants bound. Today the only way to drop them is to leave Perfect Binding, edit
the PDF in another tool, and re-open the result — which breaks the one-pass
workflow the app is built around and forces a round trip through software the
user was trying to avoid. Removal also directly changes the imposition: dropping
two pages can save a whole sheet of paper, and the user cannot see that until
after the edit.

## What Changes

- Add a page-selection step to the existing flow. Pages are **kept or removed**,
  never deleted from the source: the loaded bytes stay untouched and every
  removal is reversible while the document is open.
- Add a **contact sheet** view to the main plate area, alongside the existing
  sheet proof. The plate gains a two-way view switch — *Proof* (the built
  booklet, unchanged) and *Pages* (a thumbnail grid of the source document).
  Removing pages is done in the contact sheet at a size where the page content
  is actually readable, rather than in the narrow settings column.
- Removal gestures in the contact sheet: click a thumbnail to toggle it,
  shift-click for a run, `Delete`/`Backspace` to remove the selection,
  `Cmd/Ctrl+Z` to undo the last removal, and a per-thumbnail hover control for
  single removals without selecting first. Removed pages stay visible, dimmed
  and struck through, so the document never renumbers under the user's cursor.
- Add a **Pages** section to the settings column carrying the same state in
  text form: a kept-page range field (`1-4, 9, 12-`), the quick actions
  *Remove blanks*, *Invert*, and *Restore all*, and a live count of what is
  kept. The field and the grid are two views of one selection.
- Feed the selection through the build: `buildBooklet` accepts the kept page
  list, imposition is computed on the kept count, and the sheet, printed-side,
  and blank-slot statistics update live — so the paper saved by a removal is
  visible before printing.
- Surface the selection in the masthead folio line and the colophon
  (`30 pages · 6 removed`), and in the exported file name.
- **Not** in scope: reordering pages, inserting pages, rotating pages, or
  splitting a document. This change only decides which source pages take part.

## Capabilities

### New Capabilities

- `page-selection`: Choosing which source pages take part in the output — the
  kept/removed model, the contact-sheet interaction and its keyboard gestures,
  the range syntax and quick actions, blank detection, and how the selection
  flows into imposition, statistics, and export.

### Modified Capabilities

- `magazine-app-shell`: The preview plate gains a view switch and a second view
  (the contact sheet); the section column gains a numbered Pages section and
  renumbers the sections after it; the masthead folio line and the colophon
  report removed pages.
- `editorial-design-system`: The control contract gains the contact-sheet
  thumbnail — its selected, removed, and focused states, drawn in rules and
  tints rather than shadows.

## Impact

- `src/core/build.ts` — `BuildOptions` gains the kept-page list; embedding,
  crop lookup, and the "none" path map through it.
- `src/core/imposition.ts` — unchanged in its math, but callers pass the kept
  count; `sheetCount`/`blankCount` are read against the kept count in the UI.
- `src/renderer/App.tsx` — page-selection state, undo stack, the new section,
  the view switch, export naming.
- `src/renderer/components/` — new `PageGrid.tsx` (contact sheet, lazy
  thumbnails) and `PagesPanel.tsx` (range field, quick actions); `Preview.tsx`
  gains the view switch host.
- `src/renderer/lib/pdf.ts` — thumbnail rendering with a cache and cancellation,
  and blank-page detection reusing the existing margin scan.
- `src/renderer/app.css` — contact-sheet grid and thumbnail states.
- Tests: `src/core/build.test.ts` for the kept-page mapping, plus a new
  `src/renderer/lib/ranges.test.ts` for the range parser/formatter.
- Risks: thumbnail rendering for long documents must stay lazy and cancellable
  or it will compete with the debounced rebuild for the pdf.js worker; PDF bytes
  must continue to live in refs, never in React state.
- No new dependencies; no change to `electron/` or the CSP.
