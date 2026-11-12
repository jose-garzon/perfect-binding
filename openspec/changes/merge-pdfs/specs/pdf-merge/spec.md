## ADDED Requirements

### Requirement: Several PDFs can be opened as sources

The application SHALL accept more than one PDF, both from the landing dropzone (multi-file drop or picker) and from the editor after a document is open. Each accepted PDF SHALL become a source in an ordered source list, appended in the order added. A PDF that fails to load SHALL be reported by name and SHALL NOT affect sources already loaded.

#### Scenario: Three PDFs dropped at once

- **WHEN** the user drops three PDFs on the landing screen
- **THEN** the editor opens with three sources listed in drop order, each showing its name and page count

#### Scenario: Adding a PDF later

- **WHEN** one PDF is open and the user adds another from the editor
- **THEN** the new PDF is appended as the last source and the first source's selection is unchanged

#### Scenario: A broken file among valid ones

- **WHEN** the user adds two valid PDFs and one corrupt file
- **THEN** the two valid PDFs become sources and the interface names the file that could not be opened

### Requirement: Page selection per source with the existing selector

The application SHALL let the user choose an active source, and the existing page selector (contact sheet, range field, quick actions, undo) SHALL operate on the active source only. Each source SHALL keep its own independent selection and undo history while other sources are active.

#### Scenario: Different ranges per source

- **WHEN** the user keeps `1-10` of source 1, `10-15, 25-30` of source 2, and `2, 10-15` of source 3
- **THEN** each source retains exactly that selection when the user switches between them

#### Scenario: Undo is scoped to the active source

- **WHEN** the user edits source 2, switches to source 3, and presses undo
- **THEN** only source 3's last change is undone

### Requirement: Sources can be reordered and removed

The source list SHALL let the user move a source up or down and remove a source. Removing a source SHALL discard its selection. The last remaining source SHALL be removed only by closing the document, as today.

#### Scenario: Reordering changes output order

- **WHEN** the user moves source 3 above source 1
- **THEN** the merged document starts with source 3's kept pages

#### Scenario: Removing a source

- **WHEN** the user removes source 2
- **THEN** its pages leave the merged document and the other sources keep their selections

### Requirement: One merged document drives output

The application SHALL compose a merged document from the kept pages of every source, in source-list order and ascending source-page order within each source. Preview, statistics, crop, binding, export, and print SHALL operate on this merged document exactly as they do on a single PDF. Source files SHALL NOT be modified.

#### Scenario: Merged page count

- **WHEN** sources keep `1-10`, `10-15, 25-30`, and `2, 10-15`
- **THEN** the merged document has 10 + 12 + 7 = 29 pages in that order and the statistics report 29 pages

#### Scenario: Printing the merged job

- **WHEN** the user prints with three sources selected
- **THEN** a single print job is sent containing the merged document laid out with the current binding settings

#### Scenario: Exporting the merged job

- **WHEN** the user exports with more than one source
- **THEN** one PDF is saved, named after the first source with a merged suffix

### Requirement: Single source behaves as before

With exactly one source, the application SHALL behave as it did before this change, including output bytes, file naming, and selection behavior.

#### Scenario: One PDF opened

- **WHEN** the user opens a single PDF
- **THEN** no merge step changes the output and the export name matches the previous format
