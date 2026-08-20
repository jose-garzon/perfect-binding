## ADDED Requirements

### Requirement: Masthead

The document screen SHALL open with a masthead spanning the window: the wordmark on
the left, a folio line naming the open document and its page count, and the replace
and export actions on the right. The masthead SHALL be separated from the body by a
hairline rule, SHALL remain draggable as the Electron window chrome, and its
controls SHALL be excluded from the drag region.

#### Scenario: A document is open

- **WHEN** a PDF has been loaded
- **THEN** the masthead shows the wordmark, the file name, the source page count, and
  enabled replace and export actions

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
boxed card. The column SHALL scroll independently of the preview.

#### Scenario: The workflow reads in order

- **WHEN** a booklet binding is selected
- **THEN** the column presents Binding, Paper, Margins, and Printing as numbered
  sections in that order, followed by the assembly steps

#### Scenario: Sections adapt to the selected binding

- **WHEN** the "Margins only" method is selected
- **THEN** the booklet-only sections and controls are absent, and the remaining
  sections stay correctly numbered and separated

#### Scenario: Long settings scroll without moving the preview

- **WHEN** the column's content is taller than the window
- **THEN** the column scrolls on its own and the preview and colophon stay in place

### Requirement: Binding directory cards

The four binding methods SHALL be presented as selectable entries, each pairing its
diagram with a title and a one-line description, separated by hairline rules. The
selected entry SHALL be distinguished by its border and ground and SHALL carry
`aria-pressed="true"`. Each entry's text SHALL begin with its title.

#### Scenario: Choosing a method

- **WHEN** the user activates the "Perfect binding" entry
- **THEN** that entry becomes the pressed one, the others release, and the preview
  rebuilds for the new imposition

#### Scenario: Diagrams match the design system

- **WHEN** the entries are displayed
- **THEN** each diagram is drawn in the ink and rule tokens at the system's stroke
  weight, in both light and dark palettes

### Requirement: Preview plate

The built booklet SHALL be shown as a sheet centred on a tinted ground, with a
caption line naming the sheet, its total, which side is shown, and whether it is
rotated. Navigation between sides SHALL be available as hairline controls and by
arrow and page keys. A rebuild in progress SHALL be indicated without removing the
sheet on screen.

#### Scenario: A sheet is shown

- **WHEN** a build completes
- **THEN** a canvas of the sheet is rendered in landscape on the plate, and the
  caption reads which sheet of how many and which side

#### Scenario: The fold guide follows the binding

- **WHEN** a saddle or folded binding is selected
- **THEN** a fold guide is drawn down the middle of the sheet; **AND WHEN** perfect
  binding or margins-only is selected, no fold guide is drawn

#### Scenario: Rebuilding after a settings change

- **WHEN** a setting changes and the booklet is being rebuilt
- **THEN** a busy indicator appears in the preview furniture while the previously
  rendered sheet stays visible until the new one is ready

#### Scenario: Paging through the sheets

- **WHEN** the user presses the right arrow or activates the next control
- **THEN** the next side is rendered and the caption updates; the controls are
  disabled at the first and last side

### Requirement: Colophon of statistics

Beneath the preview the interface SHALL show a row of statistics — source pages, and
for a booklet the sheets of paper, printed sides, blank slots, and duplex flip —
each as an uppercase tracked key above its value, separated by hairline rules. When
margin trimming is on, the trimmed amount SHALL be included.

#### Scenario: Statistics for a booklet

- **WHEN** a saddle-bound booklet has been built
- **THEN** the colophon shows the source page count, sheet count, printed sides,
  blank slots, and the duplex flip setting

#### Scenario: Statistics track the settings

- **WHEN** margin trimming is enabled
- **THEN** a trimmed statistic appears reporting how much width and height was
  removed, and it updates as the crop changes

### Requirement: Cover screen before a document is loaded

With no document open, the app SHALL present a cover: a display headline, a serif
standfirst, and a dropzone presented as a framed plate. Below the cover the four
binding methods SHALL be laid out as a directory grid of hairline cells, each with
its diagram, name, and description. Load failures SHALL be reported on this screen.

#### Scenario: First launch

- **WHEN** the app opens with no document
- **THEN** the cover shows the headline, standfirst, dropzone, and the four-method
  directory

#### Scenario: Dropping a PDF

- **WHEN** a PDF is dropped on the plate or chosen through the file picker
- **THEN** the cover is replaced by the document screen with that file loaded

#### Scenario: Drag feedback

- **WHEN** a file is dragged over the plate
- **THEN** the plate visibly responds, and returns to rest when the drag leaves

#### Scenario: An unreadable file

- **WHEN** a file that is not a readable PDF is dropped
- **THEN** an error message is shown on the cover and no document screen is entered

### Requirement: Layout holds at desktop window sizes

The shell SHALL remain usable as the window is resized: the section column keeps a
fixed width while the preview takes the remaining space, the sheet is scaled to fit
the plate, and the directory grid reduces its column count in a narrow window.

#### Scenario: Narrow window

- **WHEN** the window is narrowed toward the minimum usable desktop width
- **THEN** no content is clipped or overlapped, the preview stays visible, and the
  directory grid drops to fewer columns

#### Scenario: Resizing with a sheet on screen

- **WHEN** the window is resized while a sheet is displayed
- **THEN** the sheet re-renders scaled to the new plate size without becoming blurry
  or overflowing
