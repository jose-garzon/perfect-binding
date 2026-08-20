## Why

Perfect Binding is a tool for making books, but its interface looks like a generic
settings panel: a green-accented sidebar of stacked form rows, rounded cards, and
drop shadows. The craft the app performs — imposition, trimming, folding — has an
editorial, print-shop character that the UI does not express. A magazine-grade
layout (Wallpaper\* as the reference) also happens to be the right functional
choice here: hairline rules and generous whitespace read better next to a white
sheet preview than shadowed cards do, and a strong type hierarchy makes the
four-step workflow legible at a glance.

## What Changes

- Replace the ad-hoc CSS variables with an editorial design system: an off-white
  paper ground, near-black ink, a single restrained accent, hairline rules instead
  of shadows, and a typographic scale with real ratios.
- Bundle two open-source webfonts as `woff2` under `src/renderer/fonts/` and load
  them with `@font-face`. Google Fonts and every other CDN are blocked by the
  Electron CSP (`default-src 'self'`), so the files must ship with the app.
  `build.ts` copies them into `dist/`.
- Rebuild the app shell as a magazine spread: a masthead (wordmark, folio-style
  document line, export), a left column of numbered sections separated by rules,
  and the preview presented as a plate on a tinted ground with a caption line.
- Rebuild the landing screen as a cover page: oversized display headline, a
  dropzone that reads as a framed plate, and the four binding methods laid out as
  a directory grid with their diagrams — the reference's "Architects' Directory"
  treatment.
- Restyle every control (segmented, switch, slider, select, binding cards) to the
  new system: square-ish corners, hairline borders, uppercase tracked labels,
  no drop shadows.
- Keep light and dark palettes, designed light-first, still driven by
  `prefers-color-scheme`.

Not changing: any imposition, crop, or PDF-building logic; the Electron main
process; the CSP itself.

## Capabilities

### New Capabilities

- `editorial-design-system`: The visual language of the renderer — colour tokens
  for light and dark, the typographic scale and the two bundled typefaces, spacing
  and rule conventions, and the styling contract every control obeys.
- `magazine-app-shell`: The screen-level layout — masthead, section column,
  preview plate, statistics footer, and the landing cover — including how they
  respond to window size and how the workflow steps are numbered and separated.

### Modified Capabilities

None. `openspec/specs/` is empty, and no imposition, crop, or build behaviour
changes.

## Impact

- `src/renderer/app.css` — rewritten.
- `src/renderer/App.tsx` — shell, landing, and section markup restructured.
- `src/renderer/components/Controls.tsx`, `Preview.tsx`, `Dropzone.tsx` — markup
  adjusted to the new classes; `Diagrams.tsx` restyled to the new stroke weight
  and palette.
- `src/renderer/fonts/` — new directory, two `woff2` files plus their licences.
- `build.ts` — copies the font directory into `dist/`.
- `README.md` — the Layout section gains the fonts directory.
- No dependency changes; no change to `src/core/`, `electron/`, or the CSP.
- Risk: `scripts/smoke.cjs` asserts a sheet renders and the CSP holds, and the
  renderer must keep PDF bytes out of React state. Both are markup-adjacent, so
  `bun run smoke:dev` gates the change.
