## Context

Today `App.tsx` holds one `file`, its bytes in a `source` ref, one `PDFDocumentProxy`, and one `usePageSelection(pageCount)`. `buildBooklet(bytes, { pages: selection.kept, ... })` builds the output; print rasterizes the built bytes. Page selection is an ascending kept-set over one document (spec: no reordering). pdf-lib and pdfjs are already dependencies.

## Goals / Non-Goals

**Goals:**
- Add N PDFs, pick pages from each with the existing selector, get one merged output to preview/export/print.
- Reuse the current selector UI (PageGrid, PagesPanel, range field, quick actions, undo) without forking it.
- Zero behavior change with a single source.

**Non-Goals:**
- Reordering individual pages or interleaving pages across sources (order = source order, ascending within source).
- Duplicating a page or the same source twice with different selections (could come later).
- Per-source crop/binding settings; settings stay job-wide.
- Persisting a multi-source session across app restarts.

## Decisions

1. **Merge first, then run the existing pipeline.** A pure `mergeSources(sources: {bytes, pages}[]) → Uint8Array` in `src/core/merge.ts` uses pdf-lib `copyPages` to build a composite PDF of kept pages. That composite is passed to `buildBooklet` with `pages: null`. *Alternative:* teach `buildBooklet` to take multiple inputs — rejected; it touches imposition/crop indexing everywhere and duplicates selection logic. The composite keeps core untouched and is unit-testable.
   - Single-source shortcut: with one source, skip merging and keep passing `pages: selection.kept` so the path is byte-identical to today.

2. **Selection per source via a keyed store.** Replace the single hook with `useSourceSelections()` holding `Map<sourceId, {removed, history}>`, exposing a `PageSelection`-shaped view for the active source. PagesPanel/PageGrid receive the same props as today. *Alternative:* one `usePageSelection` per mounted source component — rejected, hooks can't be created dynamically from a list cleanly.

3. **Source model.** `interface Source { id; name; bytes (ref, never state — same rule as today); doc: PDFDocumentProxy; pageCount }`. Order is array order in state; bytes in a `Map` ref keyed by id.

4. **Active source drives the contact sheet**; the sheet proof/preview shows the merged output. Thumbnail cache keys gain the source id (`clearThumbnails` scoped per source).

5. **Rebuild trigger.** Merge + build debounced on any selection/order/settings change, as builds are today. Merge is cheap (no rasterization), but cache the composite keyed by `(order, kept per source)` to avoid redundant work.

6. **Crop & blank scans** run on the composite's pdfjs doc for the preview/crop panel; "remove blanks" quick action runs on the active source.

7. **Export name**: single source → current name; multiple → `<first-name>+<n>-merged-<binding>.pdf`.

## Risks / Trade-offs

- [Memory with many large PDFs: N source bytes + composite + built output] → keep bytes in refs, close pdfjs docs on remove, build composite only from kept pages.
- [Encrypted/odd PDFs fail in `copyPages`] → load with `ignoreEncryption`, surface per-source error and keep other sources.
- [Mixed page sizes across sources] → already handled by build per-page; "source" paper size uses each page's own size — document in UI.
- [Spec "last page cannot be removed" now ambiguous] → guard applies per source; emptying a source is done by removing the source.

## Open Questions

- Should one PDF be addable twice (e.g. to repeat or reorder segments)? Deferred; design allows it since sources are keyed by id, not file.
