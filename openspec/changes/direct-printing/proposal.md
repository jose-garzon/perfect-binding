## Why

The app builds a print-ready booklet and then stops: the only way to get paper out
of it is Export PDF, save somewhere, open the file in another program, print from
there. That is three programs and a stray file for a job the app already holds in
memory, and it is worst exactly where the draft print is used — reprinting the one
sheet that jammed or came out crooked. The bytes are already built; the app should
be able to send them to a printer itself.

## What Changes

- A **Print** action in the masthead, next to Export PDF, and `Cmd/Ctrl+P` as its
  shortcut. It opens a print panel over the app rather than the OS dialog, because
  Electron reports nothing back from the OS dialog and so nothing chosen there can
  be remembered.
- A **print panel**: printer picker (the machine's real printers), copies, duplex
  mode, colour or greyscale, paper size, scale, and what to print — everything, a
  range, or the sheet on screen. A **System dialog…** escape hatch stays for the
  one-off job that needs a driver setting the panel does not carry.
- **Printer preferences are saved** to the app's existing `settings.json` and
  restored on the next launch, so the second print is one click.
- **One-click reprint of the sheet on screen**: with preferences set, a print
  control in the preview caption sends the current physical sheet — front and back
  — straight to the saved printer with no dialog.
- **Range printing** in sheets (in output pages for margins-only), reusing the same
  range grammar the Pages panel already parses.
- Printing goes through the built PDF **without exporting it**: the main process
  writes the bytes to a private temp file, prints it, and deletes it. No save
  dialog, nothing left in the user's file system.
- The preview caption **names the source pages on the side**: `Sheet 2 of 20 ·
  back · pages 3–4`, so the sheet on screen can be matched to the document without
  counting.
- The web build (`bun run web`, no Electron bridge) keeps its current behaviour and
  falls back to the browser's own print of the built PDF; the panel and saved
  preferences are desktop-only.

## Capabilities

### New Capabilities

- `direct-printing`: sending the built booklet to a printer from inside the app —
  the print panel, saved printer preferences, what a job may cover (everything, a
  range, the sheet on screen), the temp-file print path, and the web fallback.

### Modified Capabilities

- `magazine-app-shell`: the masthead gains the Print action and its shortcut, and
  the preview plate caption gains the source page numbers for the side on show and
  a print control for the sheet on show.

## Impact

- `electron/main.cjs`: IPC handlers for listing printers, printing bytes, and
  reading/writing print preferences.
- `electron/preload.cjs`: `window.desktop.print` bridge.
- New `electron/print.cjs`: temp-file lifecycle, offscreen print window, option
  mapping onto `webContents.print`.
- `electron/updates.cjs`: its `readSettings`/`writeSettings` pair becomes the shared
  settings store rather than an update-only one.
- `src/renderer/App.tsx`: print state, the shortcut, the masthead action.
- New `src/renderer/components/PrintPanel.tsx`.
- `src/renderer/components/Preview.tsx`: caption page numbers and the sheet print
  control.
- `src/renderer/lib/ranges.ts`: reused for the sheet range; new mapping from sheets
  to output page ranges.
- `electron/csp.cjs`: unchanged — the print window loads a `file:` PDF, no new
  network origin.
- No new dependencies. Nothing leaves the machine.
