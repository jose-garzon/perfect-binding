# draft-print Specification

## Purpose

Draft print is the imposition that gives up the booklet: an "Optimized draft print"
method that lays the kept pages two to a printed side in straight reading order, so
four pages ride one double-sided sheet and the stack is read as printed rather than
folded, nested, or cut. It shares the paper, margin, gutter, duplex, and selection
settings with the other two-up methods, drops the fold-or-cut guide that has no
meaning for it, and names its exports as drafts so they are never mistaken for a
bound booklet.

## Requirements

### Requirement: Sequential two-up draft imposition

The app SHALL offer an "Optimized draft print" method that imposes the selected pages
two per printed side in straight reading order, with no nesting, folding, or cutting.
Sheet *i* (0-based) SHALL carry source pages `4i+1` and `4i+2` on its front, left slot
then right slot, and `4i+3` and `4i+4` on its back, left slot then right slot. Four
source pages SHALL therefore occupy one physical sheet printed double-sided, and the
sheets SHALL be produced in ascending page order.

#### Scenario: Eight pages onto two sheets

- **WHEN** an eight-page selection is imposed as an optimized draft print
- **THEN** the sides carry, in order, `[1, 2]`, `[3, 4]`, `[5, 6]`, `[7, 8]`, the first
  two sides being the front and back of sheet 1 and the last two the front and back of
  sheet 2

#### Scenario: Reading the printed stack returns the source order

- **WHEN** the sides of a draft print are read in printed order, left slot before
  right slot, front before back
- **THEN** the source pages come back in ascending order with no page repeated or
  missing

#### Scenario: Only the kept pages are imposed

- **WHEN** pages have been removed from the selection and a draft print is built
- **THEN** the kept pages fill the slots in ascending order with no gap where a removed
  page was

### Requirement: Draft sheets pad to whole sheets

A draft print SHALL consume a whole number of sheets. When the selection does not
divide by four, the unfilled slots SHALL be left blank and SHALL all fall at the end of
the last sheet. The reported sheet count, printed-side count, and blank-slot count
SHALL be the same arithmetic the other two-up methods report.

#### Scenario: A selection that does not fill the last sheet

- **WHEN** a five-page selection is imposed as an optimized draft print
- **THEN** two sheets are produced, the sides carry `[1, 2]`, `[3, 4]`, `[5, blank]`,
  `[blank, blank]`, and three blank slots are reported

#### Scenario: Blank slots print as empty paper

- **WHEN** a built draft print contains blank slots
- **THEN** those slots are left empty on the sheet and no source page is drawn there

### Requirement: Draft print honours the shared printing options

A draft print SHALL respond to the paper size, outer margin, spine gutter, duplex flip,
trim marks, right-to-left, page selection, and margin-trimming settings exactly as the
other two-up methods do. Right-to-left SHALL mirror the two slots of every side, so
that a sheet reads `2, 1` then `4, 3`. Long-edge duplex flip SHALL rotate every back
side by 180°.

#### Scenario: Right-to-left mirrors each side

- **WHEN** an eight-page draft print is built with right-to-left enabled
- **THEN** the sides carry, in order, `[2, 1]`, `[4, 3]`, `[6, 5]`, `[8, 7]`

#### Scenario: Long-edge duplex rotates the back sides

- **WHEN** a draft print is built with the duplex flip set to the long edge
- **THEN** every back side is marked rotated and is rotated 180° in the output PDF,
  and every front side is left upright

#### Scenario: Paper and margins apply

- **WHEN** a draft print is built on a chosen sheet size with an outer margin, a
  gutter, and margin trimming enabled
- **THEN** the sheets are that size in landscape, the two pages are inset by the margin
  and separated by the gutter, and each page is drawn from its trimmed content box

### Requirement: A draft sheet carries no fold or cut guide

Because a draft print is neither folded nor cut, no centre guide line SHALL be drawn on
its sheets, and the app SHALL NOT offer a fold-or-cut guide control while the method is
selected. Trim marks SHALL remain available.

#### Scenario: No guide on the built sheet

- **WHEN** a draft print is built
- **THEN** no dashed centre line appears on any sheet, whatever the guide setting was
  when another method was selected

#### Scenario: The guide control is absent

- **WHEN** the optimized draft print method is selected
- **THEN** the fold-or-cut guide switch is not shown, while the trim marks,
  right-to-left, and duplex flip controls remain

#### Scenario: Sheet furniture reflects the method

- **WHEN** a draft print is previewed
- **THEN** the preview draws no fold line over the sheet and the figure beside the
  preview shows a corner-stapled stack rather than a FOLD or CUT sheet

### Requirement: Draft assembly instructions

While the optimized draft print method is selected, the assembly steps SHALL describe
printing the sheets double-sided, stacking them in printed order without folding, and
driving a single staple through the top corner. The steps SHALL NOT mention folding,
nesting, cutting, or glue.

#### Scenario: Assembly steps for a draft

- **WHEN** the optimized draft print method is selected
- **THEN** the "How to assemble" list reads as print double-sided, stack in printed
  order, and staple once through the top corner

### Requirement: Draft exports are named as drafts

An exported draft print SHALL be named so that it is not mistaken for a booklet: the
file name SHALL carry a draft-print suffix rather than a booklet one, and SHALL keep
the existing note of how many pages were kept when pages have been removed.

#### Scenario: Exporting a draft

- **WHEN** a draft print built from `report.pdf` is exported
- **THEN** the suggested file name identifies it as a draft print and not as a booklet

#### Scenario: Exporting a draft of a partial selection

- **WHEN** a draft print of 20 of 30 pages is exported
- **THEN** the suggested file name carries both the draft-print suffix and the count of
  kept pages
