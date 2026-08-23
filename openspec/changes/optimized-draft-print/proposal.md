## Why

"Folded & glued" is not a distinct imposition: it is a saddle-stitch layout with one
sheet per signature, already reachable by dragging the Printing section's signature
slider to 1. It occupies one of four binding cards and one of four cover-directory
cells while teaching the user nothing new.

The slot is better spent on the job the app cannot currently do: a fast reading copy.
Halving the paper of a long PDF by printing two pages per side is worth doing even
when nothing is being bound — a draft, a paper to read on a train, a manuscript to
mark up. Today that requires "Margins only" (one page per sheet side, twice the
paper) or a booklet imposition whose page order is unreadable until it is folded and
stapled.

## What Changes

- **BREAKING** Remove the "Folded & glued" binding choice. Its imposition survives
  unchanged as saddle stitch with a signature size of 1 sheet.
- Add "Optimized draft print": pages are imposed two-up in straight reading order —
  sheet 1 front carries 1 and 2, its back carries 3 and 4, sheet 2 front carries 5
  and 6, and so on. No folding, no cutting, no nesting.
- Give the new method its own assembly steps: print duplex, stack the sheets in
  printed order, drive one staple through the top corner.
- Give it its own diagram, in the binding cards and in the cover directory, showing a
  stapled corner rather than a spine.
- Drop the fold/cut guide line for the new method — there is no fold and no cut — and
  keep the outer margin, spine gutter, duplex flip, trim marks, right-to-left, page
  selection, and margin trimming controls working as they do for every other method.
- Rename the exported file's suffix for the new method so a draft is not mistaken for
  a booklet.

## Capabilities

### New Capabilities

- `draft-print`: sequential two-up imposition for a corner-stapled reading copy — the
  page order, the sheet padding, the assembly instructions, and which printing
  controls apply.

### Modified Capabilities

- `magazine-app-shell`: the four binding methods named in the binding-card and
  cover-directory requirements change membership, and the fold-guide requirement no
  longer applies to a "folded" binding.

## Impact

- `src/core/imposition.ts` — a third `Binding` value with its own page-order function,
  and its branch in `assemble` for the round-trip check.
- `src/core/build.ts` — the guide line is a fold or a cut for existing methods and
  neither for a draft; the `BuildOptions.binding` union widens.
- `src/renderer/App.tsx` — `BindingChoice` loses `"folded"` and gains `"draft"`; the
  binding cards, the `coreBinding` mapping, the assembly steps, the signature-size and
  guide-line controls, and the export file name all follow.
- `src/renderer/components/Diagrams.tsx` — `FoldedDiagram` is replaced by a draft
  diagram; `SheetDiagram` gains a stapled-corner case.
- `src/renderer/components/Preview.tsx` — the `binding` prop union.
- `src/core/imposition.test.ts`, `src/core/build.test.ts` — cover the new order and
  its round trip.
- `README.md` — the binding list, the method descriptions, and the source-tree note.
- No new dependencies. The output is still a single PDF built in the browser.
