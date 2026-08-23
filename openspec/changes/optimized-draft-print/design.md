## Context

Imposition lives in one pure module, `src/core/imposition.ts`. It maps a source page
count onto `SheetSide` records — one per printed side, two page slots each — and
`src/core/build.ts` paints those slots onto landscape sheets with pdf-lib. The core
knows two bindings, `"saddle"` and `"perfect"`; `build.ts` adds `"none"` for
margins-only work, which bypasses imposition entirely.

The renderer has a fourth choice that the core does not: `"folded"` is a UI-level
alias for `"saddle"` with `sheetsPerSignature: 1`, mapped in `coreBinding()` in
`App.tsx`. Nothing in the core, the build, or the tests knows the name — which is
exactly why it is cheap to remove and why it was never worth a card of its own.

Settings are held in React state with no persistence, so removing a choice cannot
strand a saved preference.

## Goals / Non-Goals

**Goals:**

- A third real imposition in the core: sequential two-up, `1,2 / 3,4 / 5,6 …`.
- One card in, one card out — the binding directory stays at four entries in both the
  settings column and the cover.
- Everything orthogonal to page order (paper size, outer margin, gutter, duplex flip,
  trim marks, right-to-left, page selection, margin trimming) works untouched.
- The round-trip property test that guards the other impositions covers this one too.

**Non-Goals:**

- Printing a staple mark, a corner target, or any furniture the other methods do not
  draw. Trim marks already exist for anyone who wants corner marks.
- Four-up or eight-up draft layouts. One sheet still carries four source pages.
- Persisting or migrating the removed choice. There is nothing stored to migrate.
- Changing saddle-with-signature-size-1, which is what "Folded & glued" actually was
  and which remains reachable from the Printing section.

## Decisions

### Draft is a core `Binding`, not another UI alias

`Binding` becomes `"saddle" | "perfect" | "draft"`, with a `draftSides()` peer to
`saddleSides()` and `perfectSides()`.

The alternative — keeping it in the renderer the way `"folded"` was kept — fails on
its own terms: `"folded"` could live in the UI *because* it reduced to an existing
core layout with an existing option. A sequential two-up order reduces to nothing the
core already computes, so a UI-level mapping would mean page-order math in `App.tsx`,
away from the module that owns it and away from the tests that guard it.

`draftSides()` is the simplest of the three:

```
front: left = 4i + 1, right = 4i + 2
back:  left = 4i + 3, right = 4i + 4
```

`PAGES_PER_SHEET` stays 4, so `padToSheet`, `sheetCount`, and `blankCount` need no
change, and the existing `keep()` filter turns the overhang into `null` slots at the
end of the last sheet — which is where a draft's blanks belong anyway.

### Right-to-left and duplex flip keep working by construction

Both are applied in `impose()` after the per-binding function returns: `rtl` swaps the
two slots of every side, `duplexFlip: "long"` sets `rotate180` on back sides. Neither
touches the ordering function, so `draftSides()` inherits them at no cost and with the
same semantics the other methods have.

The consequence to state plainly: `1,2 / 3,4` is the left-to-right reading order. With
right-to-left enabled the same sheet reads `2,1 / 4,3`, which is the correct behaviour
for a right-to-left document and the same transformation the other bindings receive.

### `assemble()` gains a draft branch

`assemble()` is the round-trip oracle: it replays how a printed job is physically put
back together and must return `1..n`. For a draft the assembly is a flat read of the
stack, so the branch is a concatenation of each side's slots in emission order —
`front.left, front.right, back.left, back.right`, sheet after sheet. This is a weaker
check than the saddle branch (where the nesting math is genuinely invertible), but it
still catches an off-by-one or a transposed slot.

### No guide line for a draft, decided in the core build

`build.ts` currently draws the dashed centre line whenever `guideLine` is set. For a
draft there is no fold and no cut, so the line would mark nothing. The suppression
belongs in `build.ts` — keyed on the binding — rather than only in the renderer, so
that any caller of `buildBooklet` gets a correct sheet. The renderer additionally
hides the switch, since a control that is silently ignored is worse than no control.

The same reasoning applies to the two places the renderer draws sheet furniture: the
`.fold` overlay on the preview sheet, and `SheetDiagram`'s FOLD/CUT figure. Both get a
draft case rather than falling through to the fold drawing, which today is the default
for anything that is not `"perfect"` or `"none"`.

### `isBooklet` becomes a two-up test

`App.tsx` gates the gutter control, the Printing section, and the sheet statistics on
`isBooklet = binding !== "none"`. A draft is not a booklet but is two-up, and wants
every one of those controls. The flag keeps its behaviour and is renamed to say what
it actually tests, so the next reader does not conclude that a draft is being called a
booklet.

The export suffix does need a real change: `${binding}-booklet` would name a draft
`draft-booklet`. Drafts get `draft-print`; the other methods keep their names.

### The diagram shows a corner staple, end-on stays the house style

`Diagrams.tsx` draws every method as a cross-section down the spine, with the spot
colour spent on whatever holds the book together. A draft has no spine, so its figure
is the exception the system can afford: a stack of flat leaves seen face-on with the
spot colour on a single staple at the top corner. `FoldedDiagram` is deleted rather
than repurposed — its folded-sheet path is shared with `SaddleDiagram` through
`foldedSheet()`, which stays.

## Risks / Trade-offs

- **A draft printed duplex can come out with every back side upside down** → the same
  risk every two-up method here carries, and the same remedy: the duplex flip control.
  The assembly steps for the draft name it, as the other methods' steps do.
- **`1,2 / 3,4` is a logical order, and which physical edge a reader flips depends on
  where the staple went** → the order is what the request pins down and what the
  assembly steps describe (staple the top corner, flip along the long edge). Users who
  staple elsewhere have the duplex flip control.
- **Removing a directory card changes a screen users know** → the imposition it
  produced is unchanged and still reachable in one drag of the signature slider; the
  README's binding section says where it went.
- **The draft round-trip test is close to a restatement of the layout code** → true,
  and accepted: its value is regression cover for the padding and `rtl` interactions,
  not independent derivation of the order.
