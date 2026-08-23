## 1. Core: build over a page selection

- [x] 1.1 Add `pages?: number[] | null` to `BuildOptions` in `src/core/build.ts` —
      1-based source page numbers, ascending, kept; `null`/omitted means all pages.
- [x] 1.2 Derive the kept list at the top of `buildBooklet`: normalise (ascending,
      deduplicated, clamped to the source range) and throw a clear error when it
      resolves to no pages.
- [x] 1.3 Restrict `printable` to kept pages that have a content stream, keeping the
      existing blank-page handling and the source-indexed crop lookup (`cropFor`
      must still receive the *source* index).
- [x] 1.4 Call `impose()` with `pageCount = kept.length` and translate each slot
      number through `kept[n - 1]` when picking the embedded page.
- [x] 1.5 Emit one output page per kept page in the `binding: "none"` path, and
      report `pages`/`sheets`/`blanks` against the kept count.
- [x] 1.6 Add `inkCoverage(data, width, height, opts)` to `src/core/crop.ts` — ink
      pixels over total, same threshold model as `detectMargins`.

## 2. Core tests

- [x] 2.1 `build.test.ts`: omitting `pages` produces byte-identical output to today
      (guards existing callers).
- [x] 2.2 `build.test.ts`: a 10-page document minus 2 pages imposes as 8 pages over
      2 sheets with no blank slots, and each sheet holds the expected source pages.
- [x] 2.3 `build.test.ts`: per-page crop bounds stay attached to their source pages
      after a middle page is removed.
- [x] 2.4 `build.test.ts`: an empty kept list throws, and `binding: "none"` emits one
      page per kept page.
- [x] 2.5 `crop.test.ts`: `inkCoverage` returns ~0 for a blank buffer, a small value
      for sparse text, and a large one for a full-bleed page.

## 3. Selection state and the range parser

- [x] 3.1 Add `src/renderer/lib/ranges.ts` with `parseRanges(text, pageCount)` and
      `formatRanges(kept, pageCount)`; tolerate whitespace, single pages,
      open-ended ranges, overlaps, and descending pairs; return either a normalised
      ascending list or an error naming the offending token.
- [x] 3.2 Add `src/renderer/lib/ranges.test.ts` covering `1-4, 9, 12-`, `banana`,
      `0`, out-of-range numbers, an empty result, and round-tripping
      `parseRanges(formatRanges(kept))`.
- [x] 3.3 Hold `removed: Set<number>` in `App.tsx`, derive the memoised kept list,
      and reset it (and the undo stack) in `openFile` and `closeFile`.
- [x] 3.4 Refuse a selection that keeps no pages, and refuse removing the last kept
      page, surfacing the reason in the interface.
- [x] 3.5 Add a bounded (50-entry) snapshot undo stack with a `Cmd/Ctrl+Z` handler,
      so a run removal or a quick action undoes in one step.
- [x] 3.6 Pass the kept list into `buildBooklet` through the existing debounced
      effect and `buildId` staleness guard.

## 4. Thumbnails in `lib/pdf.ts`

- [x] 4.1 Add `renderThumbnail(doc, pageNumber, width)` rendering from the open
      source document, funnelled through a single serial queue so the margin scan
      and the rebuild keep priority.
- [x] 4.2 Cache results as `ImageBitmap` in a bounded LRU (~200 entries) keyed by
      page number, cleared when the document changes.
- [x] 4.3 Cancel queued and in-flight thumbnail work on scroll-away and on document
      close, reusing the existing `inFlight` cancellation.
- [x] 4.4 Add `scanBlanks(doc, onProgress, signal)` — a cancellable full pass
      recording `inkCoverage` per page — and cache its verdicts per document.

## 5. Contact sheet

- [x] 5.1 Add `src/renderer/components/PageGrid.tsx`: an aspect-correct tile per
      source page, lazy rendering via `IntersectionObserver`, source folio number
      and output position on kept tiles.
- [x] 5.2 Removed tiles keep their slot, dimmed and struck through; the grid never
      renumbers or reflows on a removal.
- [x] 5.3 Gestures: activate to toggle, shift-activate for a run, `Delete`/
      `Backspace` on the selection, and a per-tile remove/restore control.
- [x] 5.4 Keyboard: arrow-key roving focus, visible focus ring, and kept/removed
      state exposed as an ARIA attribute rather than styling alone.
- [x] 5.5 Add a "hide removed" toggle for documents where most pages are dropped.

## 6. Pages section and the plate view switch

- [x] 6.1 Add `src/renderer/components/PagesPanel.tsx`: the kept-page range field
      (applies on `Enter`/blur, marks invalid input, keeps the last valid selection
      live), the kept/removed summary, and a control that switches the plate to the
      contact sheet.
- [x] 6.2 Wire the quick actions *Remove blanks* (progress, cancellable, reports the
      count), *Invert*, and *Restore all*, each undoable in one step.
- [x] 6.3 Insert the Pages section between Binding and Paper in `App.tsx` and
      renumber the sections after it, keeping numbering correct in margins-only mode.
- [x] 6.4 Add the `view: "proof" | "pages"` switch to the plate in `Preview.tsx`,
      preserving the viewed sheet side across a switch and never interrupting a
      rebuild.

## 7. Reporting the removal

- [x] 7.1 Report kept and removed counts in the masthead folio line.
- [x] 7.2 Report the kept/removed source statistic in the colophon and compute the
      sheet, printed-side, and blank-slot statistics from the kept count.
- [x] 7.3 Record the page selection in the exported file name.

## 8. Styling

- [x] 8.1 Style the contact-sheet grid and tiles in `app.css` to the editorial
      system — hairline borders, ground tints, the strike rule, no shadows.
- [x] 8.2 Style the plate view switch and the Pages section controls, including
      focus rings and the invalid state of the range field.
- [x] 8.3 Check the kept, selected, removed, and focused states in both light and
      dark palettes.

## 9. Verification

- [x] 9.1 `bun test` and `bun run typecheck` pass.
- [x] 9.2 `bun run smoke:dev` passes — a sheet still renders, the CSP holds, and PDF
      bytes stay out of React state and props.
- [x] 9.3 Manual pass on a 300-page document: scrolling the contact sheet stays
      responsive, the rebuild still lands, and memory stays flat.
- [x] 9.4 Manual pass end to end: remove a run, undo it, type a range, run
      *Remove blanks*, and export — statistics and file name reflect the selection.
- [x] 9.5 Update `README.md` with the page-selection step and the new files.
