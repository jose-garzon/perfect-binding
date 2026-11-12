## Why

Perfect Binding works on one PDF at a time. Users often need to print a single job assembled from several documents — e.g. pages 1-10 of one PDF, 10-15 and 25-30 of a second, and 2 and 10-15 of a third — and today that means merging in another tool first. Letting the app take several PDFs, pick pages from each with the existing page selector, and produce one merged document to print closes that gap.

## What Changes

- The landing dropzone and the editor accept multiple PDFs; more can be added after the first is open.
- New **source list** in the editor: one entry per added PDF (name, page count, kept count, selection summary), with controls to switch the active source, reorder sources, and remove a source.
- The existing page selector (contact sheet + range field + quick actions + undo) works on the **active** source; each source keeps its own independent selection and history.
- The app composes a **merged document**: kept pages of each source, in source-list order, ascending within each source. This merged document feeds the existing pipeline (crop, binding/draft/none, preview, export, print) exactly as a single PDF does today.
- Statistics, export file name, and print reflect the merged document.
- Single-PDF use stays unchanged: one source behaves exactly as today.

## Capabilities

### New Capabilities
- `pdf-merge`: Opening several PDFs as an ordered list of sources, per-source page selection, reordering/removing sources, and composing them into one merged document used for preview, export and print.

### Modified Capabilities
- `page-selection`: Selection is now scoped per source document rather than to "the open document"; opening an additional source must not reset other sources' selections, and the "last page cannot be removed" guard applies to the merged job (a source may be fully removed only by removing the source).

## Impact

- `src/renderer/App.tsx`: file state becomes a list of sources; active-source switching; merged bytes become the build input.
- `src/renderer/lib/selection.ts`: selection state held per source (keyed map or one hook instance per source).
- `src/renderer/components/Dropzone.tsx`: multi-file drop / picker.
- New component for the source list; new `src/core/merge.ts` (pdf-lib `copyPages`) with tests.
- `electron/preload.cjs` / open-file bridge if it is limited to one file.
- Crop scans and blank scans run over the merged document.
- No new dependencies (pdf-lib already present).
