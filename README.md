# Perfect Binding

Desktop app that turns a PDF into a print-ready booklet. Reorders pages for
**stitched (saddle) binding**, **folded & glued**, or **perfect binding**, trims
dead margins so the text prints larger, and previews every sheet before you
export.

Everything runs locally — the PDF never leaves the machine.

## Run it

```bash
bun install
bun run dev        # dev server + Electron window, hot reloading
```

Other scripts:

| Script | What it does |
| --- | --- |
| `bun run dev` | Electron app against the hot-reloading dev server |
| `bun run web` | Dev server only, open http://localhost:3123 in a browser |
| `bun run build` | Bundles the renderer into `dist/` |
| `bun run start` | Builds, then runs the packaged renderer in Electron |
| `bun run package` | Builds an installer into `release/` (electron-builder) |
| `bun test` | Unit tests for the imposition, crop, and PDF-building logic |
| `bun run smoke` | Launches the packaged app, drops a 3 MB generated PDF on it, asserts a sheet renders and the CSP holds |
| `bun run smoke:dev` | Same checks against a running `bun run web` dev server (React development build) |
| `bun run typecheck` | `tsc --noEmit` |

## What the four modes do

**Stitched (saddle).** Sheets nest inside one another and are stapled through
the fold, so the outermost sheet carries the first and last pages. Page count is
padded to a multiple of 4. Thick books fold badly at the fore-edge, so the
signature slider splits the job into nested groups of N sheets that you bind
together afterwards.

**Folded & glued.** Every sheet is folded on its own — no nesting — and the
folded sheets are stacked and glued at the spine. This is a saddle imposition
with exactly one sheet per signature, so sheet 1 carries pages 4 and 1 on the
front and 2 and 3 on the back. The spine stays square no matter how long the
document is, and nothing needs stapling.

**Perfect binding.** Sheets stay flat and are printed as a *cut stack*: sheet 1
carries pages 1 and 1+N/2, sheet 2 carries pages 2 and 2+N/2, and so on. Slice
every sheet down the middle, drop the right-hand pile under the left-hand pile,
and the book is in order, ready to glue.

**Margins only.** No reordering. The detected content box is cropped and scaled
up to fill the paper — useful for academic PDFs with enormous margins.

## Margin detection

Each page is rendered small with pdf.js and scanned for non-white pixels. Rows
and columns with less ink than the noise floor are ignored, which kills scanner
speckle and edge shadows. Per-page results are merged with a low percentile so a
single full-bleed page doesn't cancel the crop for the whole document. Every
edge stays adjustable by hand in the sidebar.

## Printing

Print double-sided, landscape, **at 100% scale** (no "fit to page" — it defeats
the margin work). If the backs of your sheets come out upside down, flip the
*Duplex flip* setting between short edge and long edge; that rotates the back
sides 180° in the exported file.

## Three things worth knowing before changing the renderer

**PDF bytes never travel through React state or props.** React's development
build diffs changed props onto its performance track via `performance.measure`,
and a multi-megabyte `Uint8Array` there throws `DataCloneError: … out of memory`
and then corrupts the commit phase (`Should not already be working`). Bytes live
in refs; the preview receives a `blob:` URL and pdf.js objects are reached
through callbacks. `bun run smoke:dev` fails if this regresses.

**Fonts are bundled, and their @font-face rules live in `index.html`.** The
Electron CSP is `default-src 'self'` with no `font-src`, so nothing may be
fetched from a CDN — and a `data:` font is blocked just as firmly, which matters
because Bun's CSS bundler silently inlines any small asset it can resolve from a
stylesheet. Declaring the faces in an inline `<style>` in `index.html` keeps them
out of the bundler's reach: the paths pass through untouched, `build.ts` copies
the files into `dist/fonts/`, and `server.ts` serves them in dev. Any future
typeface has to follow the same route.

**Canvas renders are cancelled, not stacked.** pdf.js refuses to paint a canvas
that is already being painted, which React Strict Mode triggers constantly.
`renderPage` cancels any in-flight task for that canvas first.

## Layout

```
src/core/         pure logic, no DOM — unit tested
  imposition.ts   page order → sheet sides (signature size 1 = folded & glued)
  crop.ts         whitespace detection over raw pixels
  build.ts        pdf-lib output assembly
  paper.ts        paper sizes in points
src/renderer/     React UI (no framework beyond React + hand-written CSS)
  lib/pdf.ts      pdf.js loading, page rendering, margin scanning
  fonts/          Archivo and Newsreader, Latin subsets, SIL OFL (see OFL.txt)
electron/         main, preload, and the CSP applied as a response header
scripts/          dev launcher and the end-to-end smoke test
```
