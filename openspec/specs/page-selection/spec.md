# page-selection Specification

## Purpose

Page selection is the layer that decides which pages of the loaded document take
part in the job: a kept-or-removed selection over the source pages, edited either
as a contact sheet on the plate or as a field of page ranges in the settings
column, with quick actions and undo. It never rewrites the source document —
every removal is reversible for as long as the document stays open — and the
imposition, the statistics, and the exported file are all computed over the pages
that remain.

## Requirements

### Requirement: Pages are kept or removed, never deleted

The application SHALL maintain, for the open document, a selection of source pages
that take part in the output. Removing a page SHALL NOT modify the loaded source
bytes, and every removal SHALL be reversible for as long as the document stays
open. The selection SHALL always be an ascending subset of the source pages: the
application SHALL NOT offer reordering, insertion, or duplication of pages. Opening
or replacing a document SHALL reset the selection to all pages kept.

#### Scenario: A page is removed

- **WHEN** the user removes page 3 of a 20-page document
- **THEN** page 3 is excluded from the built output, the source document still
  reports 20 pages, and page 3 can be restored

#### Scenario: The selection resets with a new document

- **WHEN** a document with pages removed is replaced or closed and another is opened
- **THEN** the new document starts with every page kept

#### Scenario: The last page cannot be removed

- **WHEN** the user attempts to remove the only remaining kept page
- **THEN** the removal is refused, the page stays kept, and the interface says why

### Requirement: Contact sheet of source pages

The application SHALL offer a contact-sheet view of the source document in the main
plate area, switchable with the sheet proof. Each page SHALL be presented as a
thumbnail of its rendered content labelled with its source page number. Removed
pages SHALL remain in place — dimmed and struck through — rather than being hidden
or causing the grid to renumber or reflow. Kept pages SHALL also show their position
in the output when it differs from the source page number. The view SHALL offer a
control to hide removed pages for documents where most pages are dropped.

#### Scenario: Switching to the contact sheet

- **WHEN** the user switches the plate to the Pages view
- **THEN** a grid of page thumbnails is shown for the source document, and switching
  back returns to the sheet proof at the side that was being viewed

#### Scenario: A removed page stays visible

- **WHEN** page 5 is removed
- **THEN** its thumbnail keeps position five in the grid, is dimmed and struck
  through, still reads as page 5, and the pages after it keep their source numbers

#### Scenario: Output positions are shown

- **WHEN** pages have been removed
- **THEN** each kept thumbnail shows both its source page number and its position in
  the output

#### Scenario: Thumbnails load without blocking the build

- **WHEN** a long document's contact sheet is scrolled quickly
- **THEN** thumbnails are rendered only for tiles that come into view, tiles
  scrolled away are cancelled, tiles keep their frame so the grid does not reflow,
  and the debounced rebuild and margin scan continue to make progress

### Requirement: Direct removal gestures in the contact sheet

The contact sheet SHALL support removing and restoring pages by direct manipulation:
activating a thumbnail toggles it, shift-activating extends a run from the last
activated page, `Delete` and `Backspace` remove the current selection, and each
thumbnail SHALL offer a control that removes or restores that page alone. Every
gesture SHALL be reachable from the keyboard, and thumbnails SHALL expose their
kept or removed state as an ARIA state, not by styling alone.

#### Scenario: Toggling a single page

- **WHEN** the user activates a kept thumbnail
- **THEN** that page becomes removed; activating it again restores it

#### Scenario: Removing a run of pages

- **WHEN** the user activates page 4, then shift-activates page 9
- **THEN** pages 4 through 9 are selected, and pressing `Delete` removes all six in
  one step

#### Scenario: Keyboard operation

- **WHEN** a user moves through the grid with the arrow keys and presses the
  activation key
- **THEN** the focused page toggles, the focused tile shows a visible focus
  indicator, and its kept or removed state is announced

### Requirement: Kept-page range field

The settings column SHALL carry a Pages section holding a text field that states the
kept pages as ranges (for example `1-4, 9, 12-`). The field and the contact sheet
SHALL be two views of one selection: a change in either updates the other. Parsing
SHALL tolerate whitespace, single pages, open-ended ranges, overlapping ranges, and
descending pairs, normalising the result to ascending order. Input SHALL be applied
on `Enter` or on blur. While the text is invalid or resolves to no pages, the last
valid selection SHALL stay in effect and the field SHALL be marked invalid with the
reason.

#### Scenario: Typing a range

- **WHEN** the user types `1-4, 9, 12-` into the field of a 20-page document and
  presses Enter
- **THEN** pages 1-4, 9, and 12-20 are kept, every other page is removed, and the
  contact sheet reflects it

#### Scenario: The field follows the grid

- **WHEN** the user removes pages 5 and 6 in the contact sheet of a 20-page document
- **THEN** the field reads `1-4, 7-20`

#### Scenario: Invalid input is not applied

- **WHEN** the user types `4-` and then `banana` and leaves the field
- **THEN** the selection is unchanged, the field is marked invalid and names the
  offending input, and no rebuild is triggered

#### Scenario: An empty selection is refused

- **WHEN** the entered ranges resolve to no pages
- **THEN** the field is marked invalid, the previous selection stays live, and the
  document is not rebuilt

### Requirement: Quick actions

The Pages section SHALL offer *Remove blanks*, *Invert*, and *Restore all*.
*Remove blanks* SHALL identify pages with no content stream and pages whose ink
coverage falls below a conservative floor, and SHALL never rely on a sampled
estimate for pages it has not measured: on a document whose margin scan was sampled
it SHALL run an explicit, cancellable full pass with a progress indicator, caching
its verdicts for the open document. Each quick action SHALL report what it did and
SHALL be undoable as a single step.

#### Scenario: Removing blank pages

- **WHEN** the user runs *Remove blanks* on a scanned document with six empty versos
- **THEN** progress is shown while the pages are measured, the six pages are removed,
  and the interface reports how many were removed

#### Scenario: A blank pass is cancelled

- **WHEN** the user cancels a running blank pass, or closes the document
- **THEN** the pass stops, no pages are removed by it, and the interface returns to
  rest

#### Scenario: Inverting and restoring

- **WHEN** the user runs *Invert* on a document with pages 2 and 4 removed
- **THEN** only pages 2 and 4 are kept; **AND WHEN** *Restore all* is run, every page
  is kept again

### Requirement: Undo of selection changes

The application SHALL keep a bounded history of the selection and SHALL undo the
last selection change on `Cmd/Ctrl+Z`, including a quick action as one step. The
history SHALL be cleared when a document is opened, replaced, or closed.

#### Scenario: Undoing a removal

- **WHEN** the user removes a run of pages and presses `Cmd/Ctrl+Z`
- **THEN** the run is restored in one step and the output is rebuilt

#### Scenario: Undoing a quick action

- **WHEN** the user runs *Remove blanks* and then presses `Cmd/Ctrl+Z`
- **THEN** every page the action removed is restored in one step

### Requirement: The build imposes over the kept pages

`buildBooklet` SHALL accept the kept source pages as an ascending list of 1-based
page numbers, and SHALL treat an absent list as "every page". Imposition SHALL be
computed over the count of kept pages, so removals change the sheet count, the
blank slots, and which pages share a sheet. Per-page crop bounds SHALL stay indexed
by source page, so a removal SHALL NOT shift the crop applied to any remaining page.
Pages with no content stream SHALL keep their existing handling. The margins-only
mode SHALL emit one output page per kept page.

#### Scenario: A removal saves a sheet

- **WHEN** two pages are removed from a 10-page document bound saddle-stitch
- **THEN** the output imposes 8 pages onto 2 sheets with no blank slots, and the
  colophon reports the smaller sheet count

#### Scenario: Crops stay with their pages

- **WHEN** per-page margin trimming is on and a page in the middle is removed
- **THEN** every remaining page is trimmed with the bounds detected for that same
  source page

#### Scenario: No pages selected

- **WHEN** `buildBooklet` is called with an empty kept list
- **THEN** it fails with a clear error rather than emitting an empty document

#### Scenario: Existing callers are unaffected

- **WHEN** `buildBooklet` is called without a kept list
- **THEN** every source page takes part, exactly as before this change

### Requirement: Removals are reported alongside the output

The interface SHALL state the removal wherever it states the document's size: the
folio line and the colophon SHALL report the kept and removed counts, and the
exported file name SHALL record that pages were removed.

#### Scenario: Counts reflect a removal

- **WHEN** 6 pages of a 30-page document are removed
- **THEN** the folio line and colophon report 24 pages kept and 6 removed, and the
  sheet, printed-side, and blank-slot statistics are computed from the 24

#### Scenario: The export names the removal

- **WHEN** the user exports a booklet built with pages removed
- **THEN** the suggested file name records that the output is a page selection of
  the source
