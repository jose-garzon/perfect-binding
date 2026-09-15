## Context

Perfect Binding is an Electron app whose renderer builds the imposed booklet with
`pdf-lib` and keeps the resulting bytes in a ref (`built.current` in `App.tsx`),
never in state — a multi-megabyte typed array in props blows up React's dev-mode
structured clone. The only way those bytes reach paper today is `savePdf`, a native
save dialog handled in `electron/main.cjs`.

Three constraints shape everything below:

1. **The renderer is sandboxed** (`contextIsolation: true`, `sandbox: true`, no node
   integration) and runs under a strict CSP. It cannot touch the file system or the
   print API; every printing capability must arrive through `preload.cjs`.
2. **Electron's OS print dialog is write-only.** `webContents.print({silent:false})`
   shows the driver's dialog, and its callback reports success or failure — never
   the printer, copies, duplex, or paper the user chose. Anything the app wants to
   remember it has to have asked for itself.
3. **`webContents.print` prints a rendered web page, not a PDF buffer.** The bytes
   have to be in something that renders them.

The app already has a settings store: `electron/updates.cjs` reads and writes
`settings.json` under `app.getPath("userData")` with a defaults merge and a
never-throw read.

## Goals / Non-Goals

**Goals:**

- Print the built booklet from inside the app with no export step and no file left
  behind.
- Printer choice and job settings persisted across launches, so a repeat print is
  one click.
- Three job scopes from one panel: everything, a range, or the sheet on screen.
- The sheet on screen prints front and back as one duplex job.
- The preview caption names the source pages carried by the side on show.
- The web build degrades to something usable rather than hiding the feature.

**Non-Goals:**

- Print queue management, job status polling, or cancellation after handoff. Once
  the OS has the job it belongs to the OS.
- Reading back what the user chose in the system dialog. Not available; that is why
  the panel exists.
- Printer capability discovery beyond what `getPrintersAsync()` returns. The panel
  offers a fixed option set and lets the driver reject what it cannot do.
- Network or shared-printer configuration, driver installation, CUPS/Windows
  spooler specifics.
- Changing the imposition, the build pipeline, or the exported file in any way.

## Decisions

### An in-app print panel, not the OS dialog, as the primary path

Chosen because constraint 2 makes saved preferences impossible any other way. The
panel asks for printer, copies, duplex mode, colour, paper size, scale, and scope;
those values are ours, so they can be written to `settings.json` and replayed.

*Alternative — OS dialog every time:* zero UI to build, matches platform habit, but
kills the one-click reprint that motivates the change, and every reprint of a jammed
sheet becomes a dialog round-trip.

*Alternative — remember only the device name:* half the benefit, and the half that
matters least; copies and duplex are what actually get re-picked.

**System dialog… stays** as a secondary button in the panel, mapping to
`silent: false`. It covers driver settings the panel does not model (stapling,
tray selection, printer-side booklet modes). Preferences are not updated from it,
and the panel says so.

### Printing via a hidden window over a temp file

The main process writes `built` bytes to `app.getPath("temp")` under a randomly
named file, opens a hidden `BrowserWindow` on it with `plugins: true` so Chromium's
PDF viewer renders it, waits for `did-finish-load`, calls
`webContents.print(options, callback)`, and in the callback destroys the window and
unlinks the file.

*Alternative — print the renderer's own DOM:* would print the app's UI, not the
imposed PDF, and would re-rasterise through the preview canvas at screen DPI.

*Alternative — hand the OS a file and shell out to `lp`/`PrintUI`:* platform-forked
shell invocation, no Windows story worth having, and a file the user can find.

*Alternative — `printToPDF`:* produces a PDF, which is the thing we already have.

Temp-file hygiene: the file is unlinked in the print callback **and** on
`will-quit`, and lives in a per-run subdirectory removed at exit, so a crash mid-job
does not accumulate documents in the temp directory. The file is written with mode
`0600`.

### `pageRanges` is expressed in output pages; the UI is expressed in sheets

Electron's `pageRanges` takes `{from, to}` **0-based, inclusive**, over the rendered
document's pages. The app talks in sheets everywhere else, and a sheet is two output
pages. So the renderer converts before it calls the bridge:

- Two-up bindings: sheet *n* (1-based) → output pages `2n-2` and `2n-1` 0-based.
  Sheets `2-4` → `{from: 2, to: 7}`.
- Margins-only: the output page *is* the source page; sheets and pages coincide, so
  the field is labelled "Pages" and maps `n → n-1`.

The range text is parsed by the existing `parseRanges` in
`src/renderer/lib/ranges.ts`, with the sheet count as its bound, so the grammar and
its error messages are the ones the Pages panel already teaches. A new pure helper
— `sheetsToPageRanges(sheets, twoUp)` — does the conversion and coalesces runs into
as few `{from,to}` entries as possible. It is pure, so it is unit-tested with
`bun test` alongside `ranges.test.ts`.

### One click prints the whole sheet, both sides

The proof view shows one *side*; the paper has two. Printing the side alone gives a
simplex page that then has to be manually re-fed to get its back. So the caption's
print control sends the sheet: output pages `2n-2` and `2n-1`, with the saved duplex
mode. For margins-only there is one page per sheet and the control prints that page.

The control is enabled only when a printer has been saved. Unset, it opens the panel
instead — the first print is always a deliberate one.

### Preferences live in the existing `settings.json`, under a `print` key

`electron/updates.cjs` grows into the shared store: `readSettings`/`writeSettings`
move to a new `electron/settings.cjs`, and `updates.cjs` imports them. This keeps
one file, one defaults merge, and one never-throw read rather than a second store
with its own corruption behaviour.

```
print: {
  deviceName: string | null,   // null until first chosen
  copies: number,              // >= 1
  duplex: "simplex" | "shortEdge" | "longEdge",
  color: boolean,
  paperName: string | null,    // from the printer's own list, null = driver default
  scale: number,               // percent, 100 = as built
}
```

A saved `deviceName` that no longer exists (printer unplugged, renamed) is detected
when the panel opens — it is compared against `getPrintersAsync()` — and the panel
shows the printer field as unset with a line saying the saved printer is not
available. Silent printing to a missing device is never attempted.

### `duplex` is a saved preference, not derived from the binding

Every two-up binding wants duplex, and the app already has a **Duplex flip** setting
— but that one tells the *imposition* how the printer will behave, and this one tells
the *printer* what to do. They are not the same knob and conflating them would break
the case the flip setting exists for: a printer that flips duplex the "wrong" way.
The panel defaults `duplex` to `shortEdge` for two-up jobs and `simplex` for
margins-only, and then remembers whatever the user set.

### Ctrl/Cmd+P is bound in the renderer, not as a menu accelerator

An accelerator in the app menu would fire with no document open and would need an
IPC round trip to reach the panel. The renderer already owns a `keydown` listener
pattern (`Preview.tsx`), so the shortcut is a document-level listener in `App.tsx`
that `preventDefault()`s the browser's own print, and is inert with no file loaded.
A **File → Print…** menu item is added for discoverability and sends an IPC message
the renderer handles the same way.

### The web build falls back rather than hiding

Without `window.desktop.print`, the Print action opens the built blob URL in a
hidden iframe and calls `iframe.contentWindow.print()`. The browser's own dialog
handles everything; nothing is saved. The panel is not shown, and the caption's
per-sheet control is not rendered, since neither has meaning without saved
preferences.

### Caption format

`Sheet 2 of 20 · back · pages 3–4` — the source page numbers come from the
`SheetSide` already in `output.layout`, whose `left`/`right` are 1-based source page
numbers or `null` for a blank slot. Rendering rules: both present and consecutive →
`pages 3–4`; both present, not consecutive (saddle stitch, routinely) → `pages 3, 18`;
one present → `page 3`; neither → `blank`. Rotation keeps its existing suffix. For
margins-only the caption keeps its current `Page n of m` form, since output pages and
source pages are the same thing there.

## Risks / Trade-offs

- **The hidden window's PDF viewer may render differently than the exported file
  does in another reader** → the plugin is Chromium's own PDF engine, the same one
  the preview trusts; the imposition is already flattened into the PDF geometry, and
  the print is issued at 100% scale with no margin so the driver does no fitting of
  its own.

- **Silent printing is a real-world side effect from one click** → the control is
  disabled until a printer has been deliberately chosen and saved, the panel names
  the printer that will receive the job, and the caption's control carries the
  printer name in its tooltip. There is no way to reach a silent print without
  having opened the panel once.

- **`getPrintersAsync()` is unreliable on Linux with no CUPS backend and can return
  an empty list** → an empty list is a first-class state in the panel: it says no
  printers were found and offers the System dialog… path, which delegates discovery
  to the platform.

- **A print job on a large document holds the bytes in a temp file and a second
  Chromium window** → the window is `show: false` and destroyed in the print
  callback; the file is unlinked there and again on quit. Peak cost is one extra
  copy of the built PDF, which the renderer is already holding.

- **Duplex mode as a job option is honoured inconsistently by drivers** → the panel
  labels it as a request, and the System dialog… path remains for the driver that
  ignores it. The imposition's own duplex-flip setting is unaffected either way.

- **Scale is offered but every value other than 100 breaks the imposition's
  geometry** → the default is 100, the field warns when it is moved off it, and the
  saved value is shown in the panel every time so a stale 95% cannot silently ruin
  a job.

- **The settings store move touches update behaviour** → `updates.cjs` keeps its
  exported `readSettings`/`writeSettings` names as re-exports, so its callers and its
  tests do not change; only the implementation relocates.
