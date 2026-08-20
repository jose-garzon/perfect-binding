## Context

The renderer is plain React plus one hand-written stylesheet (`src/renderer/app.css`,
310 lines) with no CSS framework, no CSS modules, and no build step beyond Bun's
bundler. `tailwindcss` and `bun-plugin-tailwind` sit in `devDependencies` but
nothing imports them. That makes a wholesale visual rewrite cheap: there is exactly
one stylesheet to replace and five component files to adjust.

Three constraints shape the work.

**The CSP has no escape hatch.** `electron/csp.cjs` sets `default-src 'self'` with
no `font-src`, so fonts fall through to `'self'`. No CDN, no `fonts.googleapis.com`.
Anything the design needs must ship inside the bundle.

**The smoke test is a DOM contract.** `scripts/smoke.cjs` drives the packaged app
through Electron and asserts on these selectors:

| Selector | Assertion |
| --- | --- |
| `.dropzone` | receives the synthetic drop event |
| `.sheet canvas` | exists, is landscape, has >200 inked pixels |
| `.sheet .fold` | present for saddle/folded, absent for perfect |
| `.sheet-label` | text reads "Sheet N of M · side" |
| `.stat` | one node per statistic, `innerText` is "KEY\nVALUE" |
| `.card` | one per binding, `innerText` starts with the title, carries `aria-pressed` |
| `.switch` | wraps an `<input>`, `innerText` includes the label |
| `.crop-preview canvas`, `.crop-box` | crop panel geometry |
| `.section ol li` | assembly steps, index 1 checked by text |
| `.error` | null when healthy |

These class names are part of the interface even though they look decorative.
The redesign keeps every one of them.

**PDF bytes must stay out of React state.** Documented in the README and enforced
by `bun run smoke:dev` against the React development build. No restructuring may
push `Uint8Array` into a prop or a `useState`.

## Goals / Non-Goals

**Goals:**

- An editorial visual language — hairline rules, off-white paper, near-black ink,
  one spot colour, a real typographic scale — applied consistently to every screen.
- Two bundled typefaces so the look is identical on macOS, Windows, and Linux, and
  identical offline.
- A shell that reads as a spread: masthead, numbered section column, preview plate
  with a caption, colophon of statistics.
- A landing screen that reads as a cover plus a directory of the four methods.
- Whitespace as a structural element: section padding roughly doubles, decoration
  drops away, and density comes from type hierarchy rather than from boxes.
- WCAG AA contrast for every text/ground pairing in both palettes.

**Non-Goals:**

- No change to `src/core/`, `electron/`, `server.ts` routing logic, or the CSP
  policy string.
- No new runtime dependency, no CSS framework, no Tailwind adoption. (The unused
  Tailwind devDependencies stay untouched — removing them is a separate cleanup.)
- No new features, settings, or workflow steps. Every control that exists today
  exists after, with the same behaviour.
- No animation system beyond the two transitions already present.
- No responsive mobile layout. This is a desktop window; the breakpoints only
  cover a narrow window, not a phone.

## Decisions

### D1: Two bundled variable fonts, Archivo and Newsreader

`Archivo` (SIL OFL, variable 400–700) for the wordmark, controls, labels, and
statistics — a tight grotesque in the Wallpaper\*/Helvetica lineage. `Newsreader`
(SIL OFL, variable, with a true italic) for editorial voice: the cover headline,
standfirst, section descriptions, and the preview caption.

*Why these two:* both are open-licensed variable fonts, so one file covers the
whole weight range and the whole download is roughly 150–250 KB for the Latin
subset. The grotesque/serif pairing is what gives the reference its character —
directory entries set in a neutral sans, editorial matter in a serif.

*Alternatives:* system stack only (rejected — the look drifts per OS and loses the
distinctiveness that is the point of the change); a single family (rejected — the
sans/serif contrast is the design); static weight files (rejected — four to six
files instead of two, for more bytes).

*Licence handling:* the OFL requires the licence to travel with the fonts.
`src/renderer/fonts/OFL.txt` ships alongside them and is listed in the README.

### D2: Declare @font-face in index.html, outside the bundler's reach

**Revised during implementation. The original decision, and its fallback, were
both wrong; what follows is what the code actually does and why.**

The original plan was to reference the fonts from `app.css` and let Bun's CSS
bundler emit them, holding `data:` URIs in reserve as the mitigation if the CSP
objected. Building it showed the opposite of what that assumed:

- Bun's CSS bundler resolves *every* `url()` it finds — an unresolvable path is a
  build error, so there is no way to hand it a path to leave alone — and it
  inlines small assets as `data:` URIs. This is documented behaviour with no
  threshold setting. `loader: { ".woff2": "file" }` does not affect it.
- Newsreader (132 KB and 147 KB) was emitted as files. Archivo (35 KB) was
  inlined.
- The packaged app then failed with: *"Loading the font 'data:font/woff2;base64,…'
  violates the following Content Security Policy directive: default-src 'self'"*.
  `default-src 'self'` does not admit `data:` for fonts. The reserve mitigation
  was in fact the one guaranteed to fail.

What works: an inline `<style>` block in `src/renderer/index.html` is copied
through the HTML bundler **verbatim** — its `url()`s are never resolved, never
rewritten, never inlined. So the three `@font-face` rules live there, pointing at
`./fonts/…`, which resolves against the document URL in both environments:

| | document | `./fonts/x.woff2` resolves to |
| --- | --- | --- |
| packaged | `file://…/dist/index.html` | `dist/fonts/x.woff2`, copied by `build.ts` |
| dev | `http://localhost:3123/` | `/fonts/:file`, a route in `server.ts` |

`style-src` already allows `'unsafe-inline'`, so the block itself is permitted.
The CSP is unchanged, no font is inlined, and the licence file travels into
`dist/fonts/` with them.

*Alternatives rejected:* adding `font-src 'self' data:` to `electron/csp.cjs`
(works, one line, but loosens the policy to solve a bundler quirk); padding
Archivo past the inline threshold (depends on an undocumented constant);
injecting a stylesheet at runtime (defers first paint on a problem that has a
static solution).

### D3: Restructure markup, but keep every smoke-test selector

New structural classes (`.masthead`, `.column`, `.plate`, `.colophon`, `.cover`,
`.directory`, `.folio`) replace `.topbar`, `.sidebar`, `.stage`, `.stats`,
`.empty`, `.explainer`. The selectors in the table above are preserved verbatim,
including the `.stat` two-line `innerText` shape and the `.switch` label wrapping
an `<input>`. Where a name is both structural and contractual — `.section`,
`.card`, `.sheet` — the existing name is kept and restyled rather than renamed.

*Why not rename freely and update the smoke test:* the smoke test is the only
end-to-end guard on the renderer, and editing it in the same change as the UI it
guards removes the guard exactly when it is most needed.

### D4: Palette — paper, ink, one spot colour

Light is the primary palette; dark is derived from it.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#faf8f4` | `#131211` | window ground |
| `--surface` | `#fffefb` | `#1c1a18` | raised panels, the sheet plate ground |
| `--ink` | `#12110f` | `#f2efe8` | headings, values |
| `--ink-2` | `#55514a` | `#a9a49a` | body copy, descriptions |
| `--ink-3` | `#6f6a60` | `#8f887c` | labels, captions, meta |
| `--rule` | `#dcd7cc` | `#33302b` | hairlines |
| `--rule-strong` | `#b8b1a2` | `#4a463f` | control borders, active edges |
| `--spot` | `#b3402a` | `#e0674b` | selected state, focus ring, progress |

Contrast against `--paper`, measured: `--ink` 17.8:1, `--ink-2` 7.4:1, `--ink-3`
5.1:1, `--spot` 5.4:1. Dark, against its `--paper`: 16.3 / 7.5 / 5.3 / 5.5. Every
pairing clears AA at 4.5:1, including `--ink-3`, which is used for small uppercase
labels and therefore gets no large-text exemption.

(The first draft of this table proposed `#8a8479` / `#797369` for `--ink-3`. Both
measured 3.5:1 and 4.0:1 and were darkened/lightened to the values above.)

*Why a print red instead of keeping the green:* a single warm spot on cool paper is
the magazine convention, and it stays legible as a *state* marker (selected card,
focus ring) precisely because nothing else on screen is coloured. The green accent
currently competes with the sheet preview for attention.

### D5: Depth comes from rules, not shadows

`--shadow-sm` and `--shadow-md` are removed; every card, panel, and control gets a
1px `--rule` border instead. Exactly one shadow survives, `--shadow-plate`, on the
sheet in the preview — a physical sheet of paper on a tinted ground is the one
place a shadow carries meaning. Radii drop from 9–18px to 0–3px; the design is
rectilinear.

### D6: Type scale and the label convention

A 1.25 modular scale, in `rem`, exposed as `--t-1` … `--t-8`
(11 / 13 / 15 / 19 / 24 / 34 / 54 / 76 px at a 16px root).

- Section titles and stat keys: Archivo 600, `--t-1`, uppercase, `.12em` tracking.
- Controls and card titles: Archivo 500–600, `--t-2`/`--t-3`.
- Descriptions, hints, the preview caption: Newsreader regular or italic, `--t-2`.
- Cover headline: Archivo 700, `--t-8`, `-0.035em` tracking, `0.92` line-height.

`font-variant-numeric: tabular-nums` stays on every number that changes in place.

### D7: Layout grid

Shell: masthead 64px, then `grid-template-columns: 400px 1fr`, then the colophon
as a full-width bottom rule. Section padding goes from `18px 20px` to `30px 32px`.
Section separators are 1px `--rule` full-bleed lines; each section header carries a
folio numeral (`01`, `02`) set in Newsreader italic at `--t-3` in `--ink-3`.

Preview: the sheet sits on `--paper` with `--shadow-plate` and a 1px rule, with a
caption line beneath it in Newsreader italic replacing part of the current toolbar
chrome. Nav controls become hairline squares at the caption's left.

Cover: an asymmetric spread — headline and standfirst in a left column, the
dropzone as a framed plate on the right, and the four-method directory as a
4-column hairline grid below (2 columns under 900px). A large folio numeral in the
corner echoes the reference's page number.

*Why 400px and not the current 372px:* the wider column is what buys the extra
whitespace without squeezing the binding-card descriptions onto four lines.

## Risks / Trade-offs

- **Smoke test breaks on a renamed or restructured node** → Keep the selector table
  above as the checklist; run `bun run smoke` and `bun run smoke:dev` before the
  change is considered done, not after.
- **Fonts blocked or 404 over `file://` in the packaged app** → Resolved, see D2.
  File-based same-origin fonts load fine under `default-src 'self'`; `data:` fonts
  do not. `bun run smoke` on the packaged build reports zero console errors, and a
  screenshot of the packaged window confirms both faces render.
- **Bundle grows by ~315 KB** (34 KB Archivo, 132 KB + 147 KB Newsreader; more
  than the 150–250 KB estimated, because Newsreader carries an `opsz` axis) → Ship Latin-subset variable files only, and set
  `font-display: swap` with a metric-adjacent fallback stack so first paint never
  waits on them. For a desktop app loading from disk this is not a load-time cost.
- **Restructuring `App.tsx` accidentally routes PDF bytes through props** →
  The refs (`source`, `built`) and the `blob:` URL boundary are not touched; the
  edits are markup-only inside the returned JSX. `bun run smoke:dev` runs the React
  development build specifically to catch a regression here.
- **A red spot colour reads as "error"** → The existing `--danger` stays distinct in
  hue and is only ever used with the `.error` panel's tinted background and border,
  so a destructive message never looks like a selected card.
- **Dark mode gets less attention than light** → Accept it as a trade-off, but
  every token has a dark value and the acceptance pass explicitly toggles the OS
  theme once.
- **Two typefaces plus a spot colour is more design surface to keep consistent** →
  The stylesheet stays a single file with the tokens at the top, so the whole system
  is visible in one screen of code.
