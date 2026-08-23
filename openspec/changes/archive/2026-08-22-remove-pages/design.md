## Context

Perfect Binding loads a PDF once into `source.current` (a ref, never React
state), scans its margins with pdf.js, and rebuilds the whole booklet through
`buildBooklet` on a 220 ms debounce whenever any setting changes. The core is
pure and page-count driven: `impose()` maps a page *count* onto sheet sides,
and `build.ts` embeds source pages and paints them into slots.

Removing pages therefore touches three seams:

1. **Selection state** — a new, reversible notion of "which source pages take
   part", owned by the renderer.
2. **The build seam** — `buildBooklet` must impose over the kept pages while
   crop data stays indexed by *source* page.
3. **A second view of the document** — the app has never shown the source PDF
   as a whole; it shows one crop sample and the built sheets. Removing pages
   comfortably needs a contact sheet, which means a second consumer of the
   pdf.js worker competing with the margin scan and the rebuild.

Constraints inherited from the codebase: PDF bytes must never enter React
state or props (`DataCloneError` in React's dev build); the Electron CSP is
`default-src 'self'`; the core stays pure and unit-tested; no new dependencies.

## Goals / Non-Goals

**Goals:**

- Remove and restore pages without leaving the app or re-uploading anything.
- Make the cost of a removal visible: sheets, printed sides, and blank slots
  update live as pages are dropped.
- Two ways in, one state: a visual contact sheet for "that page, and that one",
  a range field for "1-4, 9, 12-" on a 300-page scan.
- Keep every removal reversible for the life of the open document.
- Keep the source bytes untouched, so a mistake is never destructive.

**Non-Goals:**

- Reordering, inserting, rotating, or splitting — the selection is always an
  ascending subset of the source pages.
- Persisting a selection across sessions, or exporting the selection itself.
- Editing page content.
- A separate "removed pages" PDF export.

## Decisions

### The selection is a set of removed pages, not a list of kept pages

App state holds `removed: Set<number>` of 1-based source page numbers; the
kept list is derived (`[1..n].filter(p => !removed.has(p))`) and memoised.

*Why:* toggling is O(1) and order-free, and the derived kept list is ascending
by construction — which is exactly the invariant the non-goal ("no reordering")
wants. *Alternative:* holding `kept: number[]` as the source of truth. Rejected:
it invites accidental reordering, makes shift-click runs and range merges into
splice arithmetic, and makes "restore" ambiguous about position.

### `buildBooklet` takes the kept pages; imposition stays unaware of removal

`BuildOptions` gains `pages?: number[] | null` — 1-based source page numbers,
ascending, kept; `null`/omitted means all pages, so every existing caller and
test keeps working. Inside `build.ts`:

- `printable` becomes `kept.filter(p => page has a content stream)`, so the
  existing genuinely-blank-page handling survives.
- crop lookup stays keyed by **source** index, because `detected.perPage` is a
  source-length array produced by the scan and must not be resliced.
- `impose()` is called with `pageCount = kept.length`. It returns slot numbers
  that are positions in the kept sequence; `build.ts` translates each through
  `kept[n - 1]` when picking the embedded page.

*Why:* it keeps `imposition.ts` pure page-count math (its whole test suite is
built on that), and confines the indirection to one translation step.
*Alternative:* strip the pages with pdf-lib (`removePage`) before building.
Rejected: it desynchronises per-page crop bounds from page indices, and adds a
full document copy to a path that runs on every debounce tick.

### The contact sheet lives in the main plate, not the settings column

The main area gains a view switch — *Proof* (today's sheet preview) and
*Pages* (the contact sheet). The settings column gets a numbered **Pages**
section with the summary, the range field, and the quick actions, plus a button
that switches the main view.

*Why:* the settings column is a single narrow measure; thumbnails there would
be too small to tell a licence page from a chapter opener, which is the entire
task. The plate is already the widest surface and already the place the user
looks to check the document. *Alternative:* a modal page manager. Rejected: it
hides the live sheet/paper statistics, which are the main feedback that a
removal was worth making.

### Removed pages stay in place, dimmed and struck through

The grid never renumbers or reflows on a removal; a removed thumbnail keeps its
slot and its source folio number, and carries the output position as a second,
quieter number when it is kept.

*Why:* renumbering under the cursor is how users double-remove and lose their
place in a long document, and reversibility is only credible if the removed
page is still visible. *Trade-off:* on documents where most pages are dropped,
the grid stays long; a "hide removed" toggle in the Pages section covers that
case without making it the default.

### Thumbnails: lazy, queued, and cached, sharing one pdf.js document

Thumbnails render from the already-open source `PDFDocumentProxy`. Rendering is
driven by an `IntersectionObserver` per tile, funnelled through a single
serial queue in `lib/pdf.ts`, and cached as `ImageBitmap` in a bounded LRU
(~200 entries) keyed by page number; tiles scrolled away cancel through the
existing `inFlight` cancellation in `renderPage`.

*Why:* the worker is shared with the margin scan and the preview's own render,
and an unqueued grid of 300 tiles starves both. *Why a serial queue rather than
a small pool:* the scan and the rebuild are the latency-sensitive work, and a
queue depth of one keeps the grid strictly in the background. *Trade-off:*
fast scrolling shows placeholders briefly; tiles keep their aspect-correct
frame so the grid never reflows as bitmaps land.

### "Remove blanks" gets its own full pass, separate from the crop scan

`scanMargins` samples every Nth page on documents over 60 pages, and
`detectMargins` returns `FULL_PAGE` both for a blank page and for a full-bleed
one — neither is a usable blank signal. So: add a pure `inkCoverage()` to
`core/crop.ts` (ink pixels ÷ total, same threshold model as `detectMargins`),
record it per page during any full pass, and treat a page as blank when it has
no content stream, or coverage falls below a small floor.

*Why:* guessing blankness for unsampled pages would silently delete content.
*Decision:* "Remove blanks" runs an explicit, cancellable full pass with the
existing progress bar, caches its verdicts for the open document, and reports
what it found (`6 blank pages removed`) rather than acting silently.

### The range field is a pure, tested module

`src/renderer/lib/ranges.ts` holds `parseRanges(text, pageCount)` and
`formatRanges(kept)`. Parsing is tolerant — whitespace, `1-4, 9, 12-`, open
ends, overlaps, descending pairs — and returns either a normalised ascending
set or a parse error with the offending token. The field applies on blur or
`Enter`; while it is invalid, the last valid selection stays live and the field
is marked, so a half-typed range never rebuilds the document.

*Why:* it is the one piece of this change with real edge cases and no DOM,
which makes it cheap to test and the natural place to put the leniency.

### At least one page must stay

Removing every page is refused at the selection layer: the last kept page
cannot be removed, and a range resolving to nothing is a parse error. This
keeps `buildBooklet`'s existing "This PDF has no pages" error unreachable from
the UI.

### Undo is a bounded stack of prior selections

Each mutation pushes the previous `Set` (capped at 50 entries);
`Cmd/Ctrl+Z` pops. Snapshots, not inverse operations — the state is a small set
of integers, and snapshots keep quick actions like *Remove blanks* undoable as
a single step. Redo is out of scope; *Restore all* covers the escape hatch.

### The selection rides the existing debounce

Selection changes are ordinary build inputs: they land in the same 220 ms
debounced effect and the same `buildId` staleness guard, so a shift-click over
40 pages triggers one rebuild.

## Risks / Trade-offs

- **Thumbnail rendering starves the rebuild or the margin scan** → single serial
  queue at the lowest priority, `IntersectionObserver` gating, cancellation on
  scroll-away, bounded bitmap cache.
- **A long document's grid becomes a memory problem** → LRU-bounded bitmaps and
  DOM tiles that keep only a frame plus a canvas; if a 500-page document proves
  heavy in testing, the grid virtualises to the visible window plus a margin.
- **Kept-index vs source-index confusion in `build.ts`** → exactly one
  translation point (`kept[n - 1]`), unit tests that assert a removal shifts the
  imposition (e.g. an 8-page document minus 2 pages imposes as 6, and page 7
  lands where the fixture says), and crop tests that keep per-page bounds
  aligned to source pages after a removal.
- **A silent "Remove blanks" deletes wanted pages** (near-blank scans, faint
  page numbers) → conservative coverage floor, an explicit report of the count,
  and one-step undo.
- **The exported file no longer matches the source page count** → the folio
  line, the colophon, and the export file name all state the removal, so the
  difference is visible before and after export.
- **Scope creep toward a page editor** → reordering and insertion are explicit
  non-goals; the selection type (an ascending subset) makes them impossible to
  add by accident.
