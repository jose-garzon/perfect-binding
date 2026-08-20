## 1. Fonts

- [x] 1.1 Create `src/renderer/fonts/` and add the Latin-subset variable `woff2`
      files for Archivo (wght 400–700) and Newsreader (roman + italic), plus
      `OFL.txt` covering both families.
- [x] 1.2 Declare the `@font-face` rules with `font-display: swap`, the correct
      `font-weight` ranges for the variable axes, and `url("./fonts/…")` relative
      paths — in an inline `<style>` in `index.html`, not in `app.css`. See the
      revised design D2: the CSS bundler inlines small assets as `data:` URIs and
      `default-src 'self'` blocks a `data:` font.
- [x] 1.3 Run `bun run web` and confirm both families load in the browser with no
      404 and no CSP violation.
- [x] 1.4 Run `bun run build` and inspect `dist/`: the `woff2` files are copied to
      `dist/fonts/` by `build.ts` and the built CSS contains no `data:` URI. The
      dev server serves them from `/fonts/:file`, filename-guarded against
      traversal.
- [x] 1.5 Run `bun run start` and confirm the fonts render in the packaged Electron
      window under the production CSP. If they are blocked, inline the two faces as
      `data:` URIs rather than loosening `electron/csp.cjs`.

## 2. Design tokens

- [x] 2.1 Replace the `:root` block in `app.css` with the palette from design D4:
      paper, surface, three ink levels, two rule weights, spot, danger.
- [x] 2.2 Add the type scale (`--t-1` … `--t-8`) and the two family tokens
      (`--font-grotesque`, `--font-serif`) with system fallback stacks.
- [x] 2.3 Replace the shadow tokens with a single `--shadow-plate`; drop the radius
      tokens to at most 3px; widen `--sidebar` to 400px.
- [x] 2.4 Rewrite the `prefers-color-scheme: dark` block to redefine only the colour
      tokens, and verify no colour is declared solely inside it.
- [x] 2.5 Set the base `body` typography: serif body copy, grotesque UI, and the
      paper ground.

## 3. Controls

- [x] 3.1 Restyle buttons: hairline borders, no shadows, ≤3px radii, grotesque
      medium; primary uses ink ground, not the spot colour.
- [x] 3.2 Restyle the select, slider, segmented control, and switch to the hairline
      system; the slider thumb and the switch's on state use the spot colour.
- [x] 3.3 Replace the focus-visible rule with a spot-coloured ring that reads on both
      palettes, and confirm every interactive element is reachable by tab.
- [x] 3.4 Restyle the field label, value, and hint: uppercase tracked labels,
      tabular-nums values, serif hints.
- [x] 3.5 Restyle `.card` as a directory entry — hairline separated, diagram beside
      the title and description — keeping `aria-pressed` and the title as the first
      line of `innerText`.
- [x] 3.6 Restyle the progress bar, spinner, `.error` panel, and `.crop-preview` /
      `.crop-box` to the new tokens.
- [x] 3.7 Update `Diagrams.tsx` to the system stroke weight and tokens so the
      diagrams read in both palettes.

## 4. Document shell

- [x] 4.1 Rebuild the header in `App.tsx` as `.masthead`: wordmark, folio line with
      file name and page count, replace and export on the right. Keep the drag region
      and the `no-drag` exclusions.
- [x] 4.2 Redraw the `Logo` mark to suit the new wordmark.
- [x] 4.3 Convert the sidebar to `.column` at 400px with full-bleed hairline
      separators and 30px/32px section padding.
- [x] 4.4 Give each section header a folio numeral in serif italic plus an uppercase
      tracked title, replacing the circled `.step` badge — keeping the `.section`
      class and the assembly `ol`.
- [x] 4.5 Rebuild the preview as `.plate` in `Preview.tsx`: sheet on the tinted
      ground with `--shadow-plate` and a hairline, caption line in serif italic
      beneath it, hairline nav controls. Keep `.sheet`, `.sheet canvas`,
      `.sheet .fold`, and `.sheet-label`.
- [x] 4.6 Rebuild the statistics row as `.colophon` with hairline separators, keeping
      one `.stat` node per statistic and its "KEY\nVALUE" text shape.
- [x] 4.7 Confirm no PDF bytes were moved into state or props during the
      restructure — `source`/`built` stay refs and the preview still takes a
      `blob:` URL.

## 5. Cover screen

- [x] 5.1 Rebuild `Landing` as `.cover`: display headline, serif standfirst, and the
      dropzone as a framed plate in an asymmetric spread.
- [x] 5.2 Restyle `Dropzone.tsx` to the plate treatment with a hairline frame and a
      restrained drag-over state, keeping the `.dropzone` class and the drop, click,
      and keyboard handlers.
- [x] 5.3 Rebuild the method explainer as `.directory`: a four-column hairline grid
      dropping to two columns below 900px, each cell with diagram, name, and
      description.
- [x] 5.4 Add the oversized folio numeral in the cover corner.
- [x] 5.5 Confirm the error panel still renders on the cover for an unreadable file.

## 6. Verification

- [x] 6.1 `bun run typecheck` and `bun test` pass.
- [x] 6.2 `bun run smoke:dev` passes against `bun run web` — this is the guard on the
      PDF-bytes invariant.
- [x] 6.3 `bun run smoke` passes against the packaged build.
- [x] 6.4 Walk the selector table in `design.md` and confirm every entry still
      resolves in the running app.
- [x] 6.5 Check the contrast of every text token against its ground in both palettes;
      each must meet the ratio recorded in design D4.
- [x] 6.6 Toggle the OS to dark and walk both screens; no element may keep a
      light-palette colour.
- [x] 6.7 Resize from full screen to the narrow desktop width: nothing clipped, the
      preview stays visible, the directory grid drops to two columns.
- [x] 6.8 Tab through both screens and confirm the focus ring is visible on every
      control.

## 7. Documentation

- [x] 7.1 Add `src/renderer/fonts/` to the Layout section of `README.md`, naming the
      two families and their licence.
- [x] 7.2 Note in `README.md` that the CSP forbids external fonts, so any future
      typeface must be bundled.
