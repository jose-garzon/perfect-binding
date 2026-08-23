## MODIFIED Requirements

### Requirement: Masthead

The document screen SHALL open with a masthead spanning the window: the wordmark on
the left, a folio line naming the open document, its page count, and — when pages
have been removed — how many are kept and how many removed, and the replace and
export actions on the right. The masthead SHALL be separated from the body by a
hairline rule, SHALL remain draggable as the Electron window chrome, and its
controls SHALL be excluded from the drag region.

#### Scenario: A document is open

- **WHEN** a PDF has been loaded
- **THEN** the masthead shows the wordmark, the file name, the source page count, and
  enabled replace and export actions

#### Scenario: Pages have been removed

- **WHEN** 6 pages of a 30-page document are removed
- **THEN** the folio line reports 24 of 30 pages kept, and returns to the plain page
  count when every page is restored

#### Scenario: Export reports success

- **WHEN** the user exports and the save completes
- **THEN** the export action confirms the save and returns to its resting label
  shortly afterwards

#### Scenario: Window remains draggable

- **WHEN** the user drags the masthead in an area that is not a control
- **THEN** the window moves, and clicking a control activates it instead of dragging

### Requirement: Numbered section column

Settings SHALL be presented in a left column of sections separated by full-bleed
hairline rules. Each workflow section SHALL carry a folio numeral and an uppercase
tracked title. Section padding SHALL be generous enough that no section reads as a
boxed card. The column SHALL scroll independently of the preview. A Pages section
SHALL sit between Binding and Paper, holding the kept-page range field, the quick
actions, and a summary of what is kept, with a control that switches the plate to
the contact sheet.

#### Scenario: The workflow reads in order

- **WHEN** a booklet binding is selected
- **THEN** the column presents Binding, Pages, Paper, Margins, and Printing as
  numbered sections in that order, followed by the assembly steps

#### Scenario: Sections adapt to the selected binding

- **WHEN** the "Margins only" method is selected
- **THEN** the booklet-only sections and controls are absent, the Pages section
  remains, and the remaining sections stay correctly numbered and separated

#### Scenario: Reaching the contact sheet from the column

- **WHEN** the user activates the Pages section's control for editing pages
- **THEN** the plate switches to the contact sheet view

#### Scenario: Long settings scroll without moving the preview

- **WHEN** the column's content is taller than the window
- **THEN** the column scrolls on its own and the preview and colophon stay in place

### Requirement: Preview plate

The plate SHALL carry two views of the job — the built booklet as a sheet, and the
source document as a contact sheet — with a hairline view switch naming both and
marking the active one. The sheet view SHALL show the built booklet as a sheet
centred on a tinted ground, with a caption line naming the sheet, its total, which
side is shown, and whether it is rotated. Navigation between sides SHALL be
available as hairline controls and by arrow and page keys. A rebuild in progress
SHALL be indicated without removing the sheet on screen. Switching views SHALL NOT
interrupt a rebuild, and returning to the sheet view SHALL restore the side that was
being viewed.

#### Scenario: A sheet is shown

- **WHEN** a build completes
- **THEN** a canvas of the sheet is rendered in landscape on the plate, and the
  caption reads which sheet of how many and which side

#### Scenario: Switching between the two views

- **WHEN** the user activates the Pages view and then the Proof view
- **THEN** the contact sheet replaces the sheet and is replaced by it again, the
  active view is marked in the switch, and the sheet returns at the same side

#### Scenario: The fold guide follows the binding

- **WHEN** a saddle or folded binding is selected
- **THEN** a fold guide is drawn down the middle of the sheet; **AND WHEN** perfect
  binding or margins-only is selected, no fold guide is drawn

#### Scenario: Rebuilding after a settings change

- **WHEN** a setting changes and the booklet is being rebuilt
- **THEN** a busy indicator appears in the preview furniture while the previously
  rendered sheet stays visible until the new one is ready

#### Scenario: Rebuilding while the contact sheet is shown

- **WHEN** pages are removed from the contact sheet
- **THEN** the rebuild runs and the colophon updates while the contact sheet stays on
  screen

#### Scenario: Paging through the sheets

- **WHEN** the user presses the right arrow or activates the next control
- **THEN** the next side is rendered and the caption updates; the controls are
  disabled at the first and last side

### Requirement: Colophon of statistics

Beneath the preview the interface SHALL show a row of statistics — source pages, and
for a booklet the sheets of paper, printed sides, blank slots, and duplex flip —
each as an uppercase tracked key above its value, separated by hairline rules. When
pages have been removed, the source statistic SHALL report the kept and removed
counts, and every other statistic SHALL be computed from the kept pages. When
margin trimming is on, the trimmed amount SHALL be included.

#### Scenario: Statistics for a booklet

- **WHEN** a saddle-bound booklet has been built
- **THEN** the colophon shows the source page count, sheet count, printed sides,
  blank slots, and the duplex flip setting

#### Scenario: Statistics track a removal

- **WHEN** two pages are removed from a 10-page saddle-bound document
- **THEN** the source statistic reports 8 of 10 pages, and the sheet, printed-side,
  and blank-slot statistics fall to the values for 8 pages

#### Scenario: Statistics track the settings

- **WHEN** margin trimming is enabled
- **THEN** a trimmed statistic appears reporting how much width and height was
  removed, and it updates as the crop changes
