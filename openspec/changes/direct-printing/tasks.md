## 1. Shared settings store

- [x] 1.1 Create `electron/settings.cjs` holding `readSettings`/`writeSettings` moved
  out of `electron/updates.cjs`, keeping the defaults merge and never-throw read, and
  add the `print` defaults block (`deviceName: null`, `copies: 1`, `duplex: "shortEdge"`,
  `color: true`, `paperName: null`, `scale: 100`)
- [x] 1.2 Make `electron/updates.cjs` import from `settings.cjs` and re-export
  `readSettings`/`writeSettings` under their existing names so no caller or test changes
- [x] 1.3 Verify update preferences round-trip unchanged after the move, and that print
  preferences written to the same file leave `updateChecks`, `lastCheck`, and `skipped`
  intact

## 2. Sheet-to-page range mapping

- [x] 2.1 Add `sheetsToPageRanges(sheets: number[], twoUp: boolean)` to
  `src/renderer/lib/ranges.ts`, returning 0-based inclusive `{from, to}` entries with
  adjacent sheets coalesced into as few entries as possible
- [x] 2.2 Add `bun test` cases in `src/renderer/lib/ranges.test.ts`: sheets `2-4` two-up →
  one entry `{from: 2, to: 7}`; sheets `1, 4-5` → two entries `{0,1}` and `{6,9}`;
  margins-only `3-6` → `{2,5}`; empty input → empty array; single sheet two-up →
  `{2n-2, 2n-1}`

## 3. Main-process printing

- [x] 3.1 Create `electron/print.cjs` with a per-run temp subdirectory under
  `app.getPath("temp")`, created lazily and removed on `will-quit`
- [x] 3.2 Implement `printBytes(bytes, options)`: write the PDF to a randomly named file
  with mode `0600`, open a hidden `BrowserWindow` (`show: false`, `plugins: true`) on it,
  wait for `did-finish-load`, call `webContents.print(options, callback)`
- [x] 3.3 In the print callback, destroy the window and unlink the file whether the job
  succeeded or failed; resolve `{ ok, reason }` to the caller
- [x] 3.4 Map the app's options onto Electron's print options: `deviceName`, `copies`,
  `color`, `duplexMode` (`simplex`/`shortEdge`/`longEdge`), `pageSize` from `paperName`,
  `scaleFactor` from `scale`, `pageRanges`, `margins: { marginType: "none" }`, and
  `silent: true` unless the system-dialog path was chosen
- [x] 3.5 Implement the system-dialog path as the same call with `silent: false`, saving
  no preference
- [x] 3.6 Guard against a `deviceName` that is not in `getPrintersAsync()`: refuse the
  job and return a reason rather than printing to the platform default

## 4. IPC and preload bridge

- [x] 4.1 Add `ipcMain.handle("print:printers")` returning `getPrintersAsync()` with the
  platform default marked
- [x] 4.2 Add `ipcMain.handle("print:job", (e, bytes, options))` delegating to
  `printBytes`
- [x] 4.3 Add `ipcMain.handle("print:prefs", (e, patch))` — no argument reads, an object
  writes and returns the merged result
- [x] 4.4 Expose `window.desktop.print = { printers, job, prefs }` in
  `electron/preload.cjs`, converting bytes to `Uint8Array` the way `savePdf` does
- [x] 4.5 Add a **File → Print…** menu item in `electron/main.cjs` that sends
  `print:open` to the focused window, and an `onOpen` subscription in the preload bridge
  mirroring `updates.onFound`
- [x] 4.6 Confirm the print window loads only a `file:` URL and that no CSP change is
  needed

## 5. Print panel

- [x] 5.1 Create `src/renderer/components/PrintPanel.tsx` with printer picker, copies,
  duplex, colour, paper, scale, and scope (everything / range / sheet on show), built
  from the existing `Field`, `Select`, `Segmented`, `Slider`, `Switch` controls
- [x] 5.2 Load printers and saved preferences when the panel opens; preselect the saved
  printer, mark the platform default
- [x] 5.3 Handle the saved printer being absent: show the field unset with a line saying
  the saved printer is unavailable, and block the job until one is chosen
- [x] 5.4 Handle an empty printer list: say so and offer only the system-dialog path
- [x] 5.5 Label the range field "Sheets" for two-up and "Pages" for margins-only, parse it
  with `parseRanges` bounded by the built sheet or page count, and show the parse error
  inline without starting a job
- [x] 5.6 Warn when scale is off 100%, since the imposition geometry is already final
- [x] 5.7 Add the **System dialog…** secondary action, with a line saying nothing chosen
  there is remembered
- [x] 5.8 Save preferences on a successful job start; leave them untouched on dismissal
  and on the system-dialog path
- [x] 5.9 Keep the panel open and report the reason when a job fails
- [x] 5.10 Make the panel dismissible with Escape and by its close control, restoring
  focus to the control that opened it

## 6. App wiring

- [x] 6.1 Add print state to `src/renderer/App.tsx`: panel open, saved preferences, and a
  `printed` confirmation flag mirroring `saved`
- [x] 6.2 Add the **Print** masthead action next to Export PDF, disabled while
  `!output || building`, showing a handoff confirmation that clears after ~2.2s
- [x] 6.3 Bind `Ctrl+P` / `Cmd+P` as a document-level `keydown` listener that
  `preventDefault()`s and opens the panel; inert with no file loaded
- [x] 6.4 Subscribe to the `print:open` message from the File menu and open the panel the
  same way
- [x] 6.5 Implement `printJob(scope)` reading `built.current`, computing `pageRanges` via
  `sheetsToPageRanges`, and calling the bridge
- [x] 6.6 Implement the web fallback: with no `window.desktop.print`, print the built blob
  URL through a hidden iframe and render neither the panel nor the caption control

## 7. Preview caption

- [x] 7.1 Extend the caption in `src/renderer/components/Preview.tsx` to name the source
  pages on the side: `pages 3–4` when consecutive, `pages 3, 18` when not, `page 3` when
  one, `blank` when neither; keep the rotation suffix
- [x] 7.2 Keep the existing `Page n of m` caption for margins-only
- [x] 7.3 Add the caption print control, enabled when a printer has been saved, printing
  both sides of the sheet on show (output pages `2n-1` and `2n`, or page `n` for
  margins-only)
- [x] 7.4 Open the print panel instead of printing when no printer has been saved
- [x] 7.5 Name the destination printer in the control's tooltip
- [x] 7.6 Style the caption additions with the existing hairline and folio tokens, and
  check the caption row still holds at the minimum window width in both palettes

## 8. Verification

- [x] 8.1 `bun test` and `bun run typecheck` pass
- [ ] 8.2 Print a saddle-stitched booklet end to end on a real printer: whole document,
  a sheet range, and the sheet on show
- [x] 8.3 Confirm the temp file is gone after a job and after a quit mid-job
- [ ] 8.4 Quit and relaunch, confirm the panel restores every saved preference
- [ ] 8.5 Print through the system dialog, confirm saved preferences are unchanged
- [x] 8.6 Run `bun run smoke` and confirm the packaged build prints with no CSP violation
  in the console
- [x] 8.7 Check the web build (`bun run web`) falls back to the browser print dialog and
  shows neither the panel nor the caption control
- [x] 8.8 Check the caption reads `Sheet 2 of 20 · back · pages 3–4` for a draft print and
  names non-adjacent pages correctly for a saddle stitch
- [x] 8.9 Update `README.md` with the print action, the shortcut, and the saved
  preferences
