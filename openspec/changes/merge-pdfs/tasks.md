## 1. Core merge

- [x] 1.1 Add `src/core/merge.ts` with `mergeSources(sources: { bytes: Uint8Array; pages: number[] }[]): Promise<Uint8Array>` using pdf-lib `copyPages` (ascending within source, source order preserved, `ignoreEncryption`)
- [x] 1.2 Add `src/core/merge.test.ts`: page count/order for the 1-10 / 10-15,25-30 / 2,10-15 example, mixed page sizes, empty selection error, source bytes untouched

## 2. Per-source selection

- [x] 2.1 Refactor `src/renderer/lib/selection.ts` into a keyed store (`useSourceSelections`) holding removed-set + undo history per source id, exposing a `PageSelection` view for the active source
- [x] 2.2 Keep `usePageSelection` behavior (last-page guard, invert, undo limit) per source; add tests for independence and scoped undo

## 3. Source model in App

- [x] 3.1 Replace single `file`/`source`/`doc` state in `App.tsx` with an ordered `Source[]` (bytes in a ref map, pdfjs doc per source) and `activeId`
- [x] 3.2 Open multiple files: update `Dropzone` (multiple input + multi-drop) and any Electron open bridge in `electron/preload.cjs`/`main.cjs`; report per-file load errors
- [x] 3.3 Add "Add PDF" action in the editor that appends sources without resetting others
- [x] 3.4 Scope thumbnail cache / `clearThumbnails` by source id; close pdfjs doc when a source is removed

## 4. Source list UI

- [x] 4.1 New `SourcesPanel` component: name, page count, kept count, range summary, active highlight, move up/down, remove
- [x] 4.2 Wire PagesPanel/PageGrid/range field/remove-blanks to the active source's selection and doc
- [x] 4.3 Hide or simplify the source list when only one source is open

## 5. Build, preview, export, print

- [x] 5.1 Compose merged bytes (cached by order + kept sets) and feed `buildBooklet(..., { pages: null })`; single-source path keeps `pages: selection.kept`
- [x] 5.2 Run crop scan and preview against the merged document; update header statistics to merged counts
- [x] 5.3 Export name: `<first>+<n>-merged-<binding>.pdf` for multiple sources, unchanged for one
- [x] 5.4 Verify print sends the merged built bytes as one job

## 6. Verification

- [x] 6.1 `bun test` and `bun run typecheck` pass
- [ ] 6.2 Extend `scripts/smoke.cjs` (or manual check via `bun run dev`) with three sample PDFs and the example ranges; confirm 29-page merged output prints/exports
