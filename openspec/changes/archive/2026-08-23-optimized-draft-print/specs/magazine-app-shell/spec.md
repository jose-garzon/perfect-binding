## MODIFIED Requirements

### Requirement: Binding directory cards

The four methods SHALL be presented as selectable entries, each pairing its diagram
with a title and a one-line description, separated by hairline rules. The four SHALL be
stitched (saddle), perfect binding, optimized draft print, and margins only. The
selected entry SHALL be distinguished by its border and ground and SHALL carry
`aria-pressed="true"`. Each entry's text SHALL begin with its title.

#### Scenario: Choosing a method

- **WHEN** the user activates the "Perfect binding" entry
- **THEN** that entry becomes the pressed one, the others release, and the preview
  rebuilds for the new imposition

#### Scenario: Choosing the draft print

- **WHEN** the user activates the "Optimized draft print" entry
- **THEN** that entry becomes the pressed one, the preview rebuilds with the pages in
  reading order two to a side, and the assembly steps describe the corner staple

#### Scenario: The folded and glued entry is gone

- **WHEN** the entries are displayed
- **THEN** no entry offers folded and glued binding, and the stitched entry with a
  signature size of one sheet produces that imposition instead

#### Scenario: Diagrams match the design system

- **WHEN** the entries are displayed
- **THEN** each diagram is drawn in the ink and rule tokens at the system's stroke
  weight, in both light and dark palettes

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

### Requirement: Cover screen before a document is loaded

With no document open, the app SHALL present a cover: a display headline, a serif
standfirst, and a dropzone presented as a framed plate. Below the cover the four
methods SHALL be laid out as a directory grid of hairline cells, each with its
diagram, name, and description, and the directory SHALL name the same four methods the
settings column offers. Load failures SHALL be reported on this screen.

#### Scenario: First launch

- **WHEN** the app opens with no document
- **THEN** the cover shows the headline, standfirst, dropzone, and the four-method
  directory

#### Scenario: The directory matches the settings column

- **WHEN** the directory is displayed
- **THEN** it lists stitched (saddle), perfect binding, optimized draft print, and
  margins only, and lists no folded and glued method

#### Scenario: Dropping a PDF

- **WHEN** a PDF is dropped on the plate or chosen through the file picker
- **THEN** the cover is replaced by the document screen with that file loaded

#### Scenario: Drag feedback

- **WHEN** a file is dragged over the plate
- **THEN** the plate visibly responds, and returns to rest when the drag leaves

#### Scenario: An unreadable file

- **WHEN** a file that is not a readable PDF is dropped
- **THEN** an error message is shown on the cover and no document screen is entered
