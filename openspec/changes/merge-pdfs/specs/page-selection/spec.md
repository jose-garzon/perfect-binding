## MODIFIED Requirements

### Requirement: Pages are kept or removed, never deleted

The application SHALL maintain, for each open source document, a selection of source pages that take part in the output. Removing a page SHALL NOT modify the loaded source bytes, and every removal SHALL be reversible for as long as the source stays open. Each selection SHALL always be an ascending subset of that source's pages: the application SHALL NOT offer reordering, insertion, or duplication of pages within a source. Opening a document as the only source, or replacing all sources, SHALL reset selection to all pages kept; adding a source SHALL NOT change the selections of other sources.

#### Scenario: A page is removed

- **WHEN** the user removes page 3 of a 20-page document
- **THEN** page 3 is excluded from the built output, the source document still
  reports 20 pages, and page 3 can be restored

#### Scenario: The selection resets with a new document

- **WHEN** a document with pages removed is replaced or closed and another is opened
- **THEN** the new document starts with every page kept

#### Scenario: Adding a source keeps other selections

- **WHEN** source 1 has pages removed and the user adds a second PDF
- **THEN** source 1's removals are unchanged and source 2 starts with every page kept

#### Scenario: The last page cannot be removed

- **WHEN** the user attempts to remove the only remaining kept page of a source
- **THEN** the removal is refused, the page stays kept, and the interface says why (removing the whole source is the way to drop it)
