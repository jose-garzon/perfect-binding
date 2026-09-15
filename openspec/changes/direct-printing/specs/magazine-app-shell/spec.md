## MODIFIED Requirements

### Requirement: Masthead

The document screen SHALL open with a masthead spanning the window: the wordmark on
the left, a folio line naming the open document, its page count, and — when pages
have been removed — how many are kept and how many removed, and the replace, print,
and export actions on the right. The masthead SHALL be separated from the body by a
hairline rule, SHALL remain draggable as the Electron window chrome, and its
controls SHALL be excluded from the drag region. The print and export actions SHALL
be disabled until a build is available.

#### Scenario: A document is open

- **WHEN** a PDF has been loaded
- **THEN** the masthead shows the wordmark, the file name, the source page count, and
  enabled replace, print, and export actions

#### Scenario: Pages have been removed

- **WHEN** 6 pages of a 30-page document are removed
- **THEN** the folio line reports 24 of 30 pages kept, and returns to the plain page
  count when every page is restored

#### Scenario: Export reports success

- **WHEN** the user exports and the save completes
- **THEN** the export action confirms the save and returns to its resting label
  shortly afterwards

#### Scenario: Print reports the handoff

- **WHEN** the user prints and the job is handed to the printer
- **THEN** the print action confirms the handoff and returns to its resting label
  shortly afterwards

#### Scenario: Window remains draggable

- **WHEN** the user drags the masthead in an area that is not a control
- **THEN** the window moves, and clicking a control activates it instead of dragging

### Requirement: Preview plate

The plate SHALL carry two views of the job — the built booklet as a sheet, and the
source document as a contact sheet — with a hairline view switch naming both and
marking the active one. The sheet view SHALL show the built booklet as a sheet
centred on a tinted ground, with a caption line naming the sheet, its total, which
side is shown, whether it is rotated, and which source pages that side carries.
Navigation between sides SHALL be available as hairline controls and by arrow and
page keys. The caption SHALL also carry a control that prints the sheet on show. A
rebuild in progress SHALL be indicated without removing the sheet on screen.
Switching views SHALL NOT interrupt a rebuild, and returning to the sheet view SHALL
restore the side that was being viewed.

#### Scenario: A sheet is shown

- **WHEN** a build completes
- **THEN** a canvas of the sheet is rendered in landscape on the plate, and the
  caption reads which sheet of how many, which side, and the source pages on it —
  for example `Sheet 2 of 20 · back · pages 3–4`

#### Scenario: A side carrying non-adjacent pages

- **WHEN** a saddle-stitched sheet side carries source pages 3 and 18
- **THEN** the caption names both — `pages 3, 18` — rather than a range

#### Scenario: A side with a blank slot

- **WHEN** a side carries one source page and one blank padding slot
- **THEN** the caption names the single page it carries

#### Scenario: A margins-only job

- **WHEN** the method is margins-only
- **THEN** the caption reads which page of how many, since an output page and a
  source page are the same thing

#### Scenario: Switching between the two views

- **WHEN** the user activates the Pages view and then the Proof view
- **THEN** the contact sheet replaces the sheet and is replaced by it again, the
  active view is marked in the switch, and the sheet returns at the same side

#### Scenario: The fold guide follows the binding

- **WHEN** a saddle binding is selected
- **THEN** a fold guide is drawn down the middle of the sheet; **AND WHEN** perfect
  binding, optimized draft print, or margins-only is selected, no fold guide is drawn

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

#### Scenario: Printing the sheet from the caption

- **WHEN** a printer has been saved and the user activates the caption's print
  control
- **THEN** the sheet on show is printed, front and back, with the saved preferences
