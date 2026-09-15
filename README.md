<img src="assets/icons/128x128.png" width="88" alt="">

# Perfect Binding

Desktop app that turns a PDF into a print-ready booklet. Reorders pages for
**stitched (saddle) binding** or **perfect binding**, prints a two-up
**optimized draft** to read, trims dead margins so the text prints larger, and
previews every sheet before you export.

Everything runs locally — the PDF never leaves the machine.

![The landing view: drop a PDF, or read the binding directory first](assets/screenshots/home.png)

## Features

- **Four ways to print.** Stitched (saddle), perfect binding, an optimized draft
  print, or margins-only with no reordering at all. Each one is explained in the
  app, in the [section below](#what-the-four-modes-do), and drawn on the card you
  pick.
- **Drop pages without leaving the app.** Switch the plate to the contact sheet,
  click a page to remove it or shift-click a run, or type the pages you want as
  ranges (`1-4, 9, 12-`). Removed pages stay in place, dimmed and struck
  through, and `Ctrl/Cmd+Z` puts them back. *Remove blanks* measures every page
  and drops the empty ones. The source file is never modified.
- **Automatic margin trimming.** Every page is scanned for its content box, the
  results are merged across the document, and the crop is scaled back up to fill
  the sheet. Nudge any edge by hand if the detector clips something.
- **A sheet-by-sheet proof.** Step through every sheet, front and back, with the
  fold line or the cut line drawn where it will fall — before you spend paper. A
  draft print is neither folded nor cut, so it gets no guide at all.
- **Print without exporting.** `Ctrl/Cmd+P` opens a print panel with the
  machine's printers, copies, duplex, colour, paper, and scale — saved and
  restored next launch. Print everything, a range of sheets, or the one sheet
  you are looking at; with a printer saved, *Print sheet* in the caption sends
  it in a single click. The booklet goes to the printer straight from memory: no
  export, no save dialog, nothing left on disk.
- **The numbers that decide the print job.** Sheets of paper, printed sides,
  blank slots, duplex flip, and how much was trimmed, kept in view at all times.
- **Paper and spine controls.** A4, Letter, Legal, A3, Tabloid, or A5; outer
  margin and spine gutter in millimetres; signature size for thick
  saddle-stitched books that would otherwise fold badly at the fore-edge.
- **Offline by construction.** No telemetry, no upload step, no account. The
  renderer runs under `default-src 'self'` and makes no network requests at all;
  the one outbound call in the app is the update check below, and it can be
  switched off.

![The working view: binding cards, paper controls, and the sheet proof](assets/screenshots/editing.png)

Margin trimming on, with the detected content box and the four edge nudges:

![The margins panel with the detected crop box](assets/screenshots/trim.png)

## Install

Prebuilt installers are attached to every release —
**[latest release →](https://github.com/jose-garzon/perfect-binding/releases/latest)**

**Linux** — download the AppImage, make it executable, run it:

```bash
chmod +x PerfectBinding-*-linux-x86_64.AppImage
./PerfectBinding-*-linux-x86_64.AppImage
```

Or install the `.deb`: `sudo apt install ./PerfectBinding-*-linux-amd64.deb`

**Windows** — run `PerfectBinding-<version>-win-x64.exe`. The build is unsigned,
so SmartScreen warns on first launch: *More info → Run anyway*.

**macOS** — open the `.dmg` (`-arm64` for Apple silicon, `-x64` for Intel) and
drag the app to Applications. Also unsigned, so the first launch needs
right-click → *Open* rather than a double-click.

## Updating

The app checks GitHub for a newer release once a day and shows a bar under the
masthead when there is one. It never downloads or installs anything — you decide.
*Not now* hides that version, *Stop checking* turns the check off for good, and
**File → Check for Updates…** asks on demand even when the check is off.

Installing the new version over the old one needs no uninstall:

| Platform | Upgrading |
| --- | --- |
| Windows | Run the new `.exe`; the installer replaces the previous version |
| macOS | Drag to Applications and confirm the replace |
| Linux AppImage | Overwrite the old file, or delete it and run the new one |
| Linux `.deb` | `sudo apt install ./PerfectBinding-*-linux-amd64.deb` |

What the check sends: a plain GET to `api.github.com` for the latest release tag,
no identifiers attached. The preference and the last-checked timestamp live in
`settings.json` in the app's user-data directory. Set `PB_NO_UPDATE_CHECK=1` to
disable it for a run — the smoke test and the screenshot script both do.

## Build it from source

```bash
bun install
bun run dev        # dev server + Electron window, hot reloading
bun run package    # installers for this platform into release/
```

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
| `bun run shots` | Re-captures the screenshots in this README |
| `bun run icon` | Re-renders the app icon PNGs from `assets/icon.svg` |
| `bun run typecheck` | `tsc --noEmit` |

## What the four modes do

**Stitched (saddle).** Sheets nest inside one another and are stapled through
the fold, so the outermost sheet carries the first and last pages. Page count is
padded to a multiple of 4. Thick books fold badly at the fore-edge, so the
signature slider splits the job into nested groups of N sheets that you bind
together afterwards.

**Perfect binding.** Sheets stay flat and are printed as a *cut stack*: sheet 1
carries pages 1 and 1+N/2, sheet 2 carries pages 2 and 2+N/2, and so on. Slice
every sheet down the middle, drop the right-hand pile under the left-hand pile,
and the book is in order, ready to glue.

**Optimized draft print.** Nothing is folded, nested, or cut: pages run straight
down the stack two to a side, so sheet 1 carries pages 1 and 2 on its front and 3
and 4 on its back, sheet 2 carries 5 and 6 then 7 and 8, and so on. Stack the
sheets in printed order and drive one staple through the top corner. Half the
paper of a one-up print, and readable the moment it comes out of the printer —
for drafts, papers, and manuscripts you mean to mark up rather than bind.

**Margins only.** No reordering. The detected content box is cropped and scaled
up to fill the paper — useful for academic PDFs with enormous margins.

*Folded & glued* used to be a fifth card here. It was a saddle imposition with
exactly one sheet per signature and nothing more, so it is now reached by picking
**Stitched (saddle)** and setting the signature slider to 1 sheet.

## Page selection

Removal is a selection, not an edit: the app keeps the set of removed source
pages and passes the kept ones to the builder, so the loaded bytes stay
untouched and any removal can be undone. Imposition is computed over the kept
count, which is why dropping two pages can save a whole sheet — the colophon
updates as you go. Per-page crops stay attached to their own source page, so a
removal never slides a crop onto its neighbour.

Blank detection is deliberately separate from the margin scan. That scan samples
long documents, and the whitespace detector reports the same "no margins" for a
blank page as for a full-bleed one — so *Remove blanks* runs its own full,
cancellable pass over the ink coverage of every page, and says how many it
removed.

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

You can print from inside the app rather than exporting first. **Print** in the
masthead, `Ctrl/Cmd+P`, or *File → Print…* opens the print panel: printer,
copies, duplex, colour, paper, scale, and what the job covers — everything, a
range, or the sheet on screen. Ranges are counted in sheets, in the same
grammar as the page field (`1-4, 9, 12-`); one sheet is two pages of the built
file. Everything you set is saved and comes back the next time you open the
panel.

Once a printer has been saved, *Print sheet* in the preview caption prints the
sheet you are looking at — both sides — with no dialog at all. That is the
button for the sheet that jammed. Before a printer has been chosen it opens the
panel instead: nothing is ever sent silently to a printer you did not pick.

Two notes on how it works. The booklet is written to a private temporary file,
printed, and deleted; it is never saved anywhere you chose, and the file is
removed again when the app quits. And the panel exists rather than the system
dialog because the platform never reports back what was picked in its own
dialog — nothing chosen there can be remembered. That dialog is still one click
away in the panel, for driver settings the panel does not carry; it just saves
nothing.

*Duplex flip* and the panel's *Sides* are different settings. The first tells
the imposition how your printer already behaves, so the backs land the right way
up. The second asks the printer to use both sides of the paper.

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

**Contact-sheet thumbnails run behind everything else.** The margin scan, the
preview, and the thumbnail grid share one pdf.js worker, and the first two are
what the user is waiting on. Thumbnails render through a serial queue in
`lib/pdf.ts`, are gated by an `IntersectionObserver` per tile, cancel when a
tile scrolls away, and are cached as bitmaps in a bounded LRU. On a 300-page
document about 18 tiles are painted at rest and the booklet still rebuilds
within a second of a change.

**Canvas renders are cancelled, not stacked.** pdf.js refuses to paint a canvas
that is already being painted, which React Strict Mode triggers constantly.
`renderPage` cancels any in-flight task for that canvas first.

## Layout

```
src/core/         pure logic, no DOM — unit tested
  imposition.ts   page order → sheet sides (saddle, perfect, sequential draft)
  crop.ts         whitespace detection over raw pixels
  build.ts        pdf-lib output assembly
  paper.ts        paper sizes in points
src/renderer/     React UI (no framework beyond React + hand-written CSS)
  lib/pdf.ts      pdf.js loading, page rendering, thumbnails, margin + blank scans
  lib/ranges.ts   the `1-4, 9, 12-` page-range syntax, parsed and formatted
  lib/selection.ts  which pages are kept, with undo — no bytes are touched
  fonts/          Archivo and Newsreader, Latin subsets, SIL OFL (see OFL.txt)
electron/         main, preload, the CSP response header, and the update check
scripts/          dev launcher, icon rasteriser, screenshots, smoke test
assets/           icon.svg (the source), its PNGs, and the README screenshots
```

The app icon is drawn once in `assets/icon.svg` — a magazine standing cover-out,
spine toward the viewer, in the same paper/ink/terracotta palette as the UI.
Edit that file and run `bun run icon` to re-render every PNG size.

## Releasing

`.github/workflows/ci.yml` runs typecheck, tests, and the renderer build on
every push and PR. `.github/workflows/release.yml` cuts the binaries:

```bash
# bump "version" in package.json first
git tag v0.2.0
git push origin v0.2.0
```

The tag fans out to Linux, Windows, and macOS runners, each running
`bun run build` + `electron-builder`, and the installers are uploaded to a
GitHub release for that tag. Re-running the workflow re-uploads over the same
release. It can also be started by hand from the Actions tab with a tag name
(`workflow_dispatch`); the tag must already exist.

## Licence

MIT — see [LICENSE](LICENSE). The bundled typefaces are under the SIL Open Font
Licence; see `src/renderer/fonts/OFL.txt`.
