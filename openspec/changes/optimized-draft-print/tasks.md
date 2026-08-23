## 1. Core imposition

- [x] 1.1 Widen `Binding` in `src/core/imposition.ts` to `"saddle" | "perfect" | "draft"`
- [x] 1.2 Add `draftSides(pageCount)`: sheet *i* emits front `[4i+1, 4i+2]` and back
  `[4i+3, 4i+4]`, reusing `padToSheet` for the sheet count
- [x] 1.3 Dispatch to `draftSides` in `impose()`, leaving the `rtl` swap and the
  `duplexFlip` rotation applied afterwards as they are today
- [x] 1.4 Add the draft branch to `assemble()`: sides flattened in emission order,
  left slot then right slot

## 2. Core build

- [x] 2.1 Widen `BuildOptions.binding` in `src/core/build.ts` to accept `"draft"`
- [x] 2.2 Suppress the centre guide line for `"draft"` regardless of the `guideLine`
  flag, leaving trim marks, gutter, outer margin, and crop untouched

## 3. Core tests

- [x] 3.1 `imposition.test.ts`: an eight-page draft gives `[1,2] [3,4] [5,6] [7,8]`
- [x] 3.2 `imposition.test.ts`: a five-page draft gives `[1,2] [3,4] [5,null]
  [null,null]`, with `sheetCount` 2 and `blankCount` 3
- [x] 3.3 `imposition.test.ts`: `assemble` round-trips a draft to `1..n` for several
  page counts, including counts that need padding
- [x] 3.4 `imposition.test.ts`: `rtl` mirrors every side to `[2,1] [4,3] …`
- [x] 3.5 `build.test.ts`: a draft emits landscape sides in the order above, and
  long-edge duplex rotates every back side by 180° in the output PDF
- [x] 3.6 `build.test.ts`: a draft built with `guideLine: true` draws no centre line
- [x] 3.7 `bun test` passes

## 4. Diagrams

- [x] 4.1 Delete `FoldedDiagram` from `src/renderer/components/Diagrams.tsx`, keeping
  the shared `foldedSheet()` helper that `SaddleDiagram` uses
- [x] 4.2 Add `DraftDiagram`: a stack of flat leaves with the spot colour on a single
  staple at the top corner, on the shared 76×56 stage and stroke weights
- [x] 4.3 Give `SheetDiagram` a `"draft"` case — a corner-stapled sheet, no dashed
  centre line, and a STAPLE label in place of FOLD/CUT — and widen its `binding` prop

## 5. App wiring

- [x] 5.1 In `src/renderer/App.tsx`, change `BindingChoice` from
  `"saddle" | "folded" | "perfect" | "none"` to `"saddle" | "perfect" | "draft" | "none"`
- [x] 5.2 Replace the "Folded & glued" entry in `BINDINGS` with "Optimized draft print"
  — one-line description, `DraftDiagram` — and drop the module comment describing
  `"folded"` as a one-sheet saddle
- [x] 5.3 Update `coreBinding()`: `"draft"` maps to the core `"draft"` binding with
  `sheetsPerSignature: 0`; the `"folded"` special case goes
- [x] 5.4 Replace the `folded` entry in `ASSEMBLY` with the draft steps: print
  double-sided, stack in printed order without folding, staple once through the top
  corner
- [x] 5.5 Remove the folded-only hint paragraph in the Printing section; leave the
  signature-size slider on saddle only, as now
- [x] 5.6 Hide the guide-line switch when the draft is selected, and keep its
  fold/cut label logic for the other methods
- [x] 5.7 Rename `isBooklet` to a two-up test and confirm the gutter field, the
  Printing section, and the sheet statistics still show for a draft
- [x] 5.8 Export naming: a draft gets a `draft-print` suffix instead of
  `${binding}-booklet`, keeping the kept-page note

## 6. Preview

- [x] 6.1 Widen the `binding` prop of `Preview` in
  `src/renderer/components/Preview.tsx` to the new union
- [x] 6.2 Draw the `.fold` overlay only for `"saddle"`, so a draft sheet gets no fold
  line

## 7. Documentation

- [x] 7.1 README: drop folded & glued from the intro, the feature list, and the method
  descriptions; describe the optimized draft print with its `1,2 / 3,4` order and its
  corner staple; note that the old imposition is saddle with a signature size of 1
- [x] 7.2 README: update the source-tree note on `imposition.ts` that calls signature
  size 1 "folded & glued"

## 8. Verification

- [x] 8.1 `bun test` and a TypeScript check pass with no reference to `"folded"` left
  in `src/`
- [x] 8.2 Run the app, build a draft from a real PDF, and confirm the proof shows
  `1,2` then `3,4`, the colophon counts sheets and blanks, and the export name says
  draft print

## 9. Discovered during implementation

- [x] 9.1 `scripts/smoke.cjs` drove the removed "Folded & glued" card in its fourth
  step; rewritten to drive the draft print and assert no fold guide, no guide switch,
  and the new assembly step
- [x] 9.2 Regenerate `assets/screenshots/*` — the README shots showed the old card —
  and fix the cover's directory subhead, which promised a book for all four methods
