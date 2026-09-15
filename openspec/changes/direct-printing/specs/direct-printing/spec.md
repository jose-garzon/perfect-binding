## ADDED Requirements

### Requirement: Printing without exporting

The application SHALL be able to send the built booklet to a printer without the
user exporting, saving, or opening the file in another program. The bytes SHALL be
handed to the printer from a private temporary file created by the application, and
that file SHALL be deleted once the job has been handed to the operating system and
again when the application quits. No save dialog SHALL be shown as part of printing,
and no file SHALL be left in a location the user chose or can browse to.

#### Scenario: A booklet is printed

- **WHEN** the user prints a built booklet
- **THEN** the job reaches the chosen printer, no save dialog is shown, and the
  document is not written anywhere the user selected

#### Scenario: The temporary file is cleaned up

- **WHEN** a print job has been handed to the operating system
- **THEN** the temporary file the application wrote is deleted

#### Scenario: The application quits with a job in flight

- **WHEN** the application quits before a print callback has run
- **THEN** the temporary file and its directory are removed at exit

#### Scenario: Nothing is printed before a build

- **WHEN** no document is open, or the current build has not completed
- **THEN** the print action is unavailable and no job can be started

### Requirement: The print action and its shortcut

The document screen SHALL offer a Print action alongside Export PDF, and SHALL bind
`Ctrl+P` — `Cmd+P` on macOS — to it. The shortcut SHALL suppress the browser's own
print behaviour, SHALL be inert when no document is open, and SHALL open the same
print panel the action opens. A File menu item SHALL open the panel as well.

#### Scenario: The action opens the panel

- **WHEN** the user activates Print with a document open
- **THEN** the print panel opens over the app

#### Scenario: The keyboard shortcut

- **WHEN** the user presses `Ctrl+P` or `Cmd+P` with a document open
- **THEN** the print panel opens and the browser's own print dialog does not appear

#### Scenario: The shortcut with no document

- **WHEN** the user presses `Ctrl+P` or `Cmd+P` on the cover screen
- **THEN** nothing happens

#### Scenario: The menu item

- **WHEN** the user chooses File → Print…
- **THEN** the print panel opens, the same as the masthead action

### Requirement: The print panel

The print panel SHALL let the user choose the printer, the number of copies, the
duplex mode, colour or greyscale, the paper, the scale, and what the job covers. The
printer list SHALL be the machine's own printers as the platform reports them, with
the platform default marked. The panel SHALL name the printer the job will go to
before it is started, SHALL be dismissible without printing, and SHALL report a
failed job without closing.

#### Scenario: Choosing a printer

- **WHEN** the panel opens
- **THEN** it lists the machine's printers, marks the platform default, and
  preselects the saved printer when there is one

#### Scenario: Starting a job

- **WHEN** the user confirms the panel
- **THEN** the job is sent with the chosen options, the panel closes, and the print
  action confirms the handoff

#### Scenario: Dismissing the panel

- **WHEN** the user dismisses the panel
- **THEN** nothing is printed and no preference is changed

#### Scenario: A job fails

- **WHEN** the printer rejects the job or the handoff fails
- **THEN** the panel stays open and reports the failure

#### Scenario: No printers are found

- **WHEN** the platform reports no printers
- **THEN** the panel says so and offers the system dialog instead of a printer list

### Requirement: Saved printer preferences

The application SHALL save the printer, copies, duplex mode, colour setting, paper,
and scale chosen in the print panel, and SHALL restore them the next time the panel
opens, including after the application is restarted. Preferences SHALL be stored
with the application's other settings and SHALL survive a corrupt or missing store by
falling back to defaults rather than failing. Duplex SHALL default to short-edge for
a two-up binding and simplex for margins-only, and scale SHALL default to 100%.

#### Scenario: Preferences are restored

- **WHEN** the user prints, quits the application, reopens it, and opens the panel
- **THEN** the printer, copies, duplex mode, colour setting, paper, and scale are the
  ones last used

#### Scenario: A saved printer is gone

- **WHEN** the saved printer is no longer reported by the platform
- **THEN** the panel shows the printer as unset, says the saved printer is
  unavailable, and does not send a job to it

#### Scenario: The settings store is unreadable

- **WHEN** the settings file is missing or corrupt
- **THEN** the panel opens with default preferences and no error is raised

#### Scenario: Print preferences do not disturb other settings

- **WHEN** print preferences are saved
- **THEN** the update-check preferences in the same store are unchanged

### Requirement: What a print job covers

The panel SHALL offer three scopes: the whole document, a range, and the sheet
currently on show. The range SHALL be entered in sheets for a two-up binding and in
pages for margins-only, SHALL accept the same range grammar the page selection field
accepts, SHALL be bounded by the built sheet or page count, and SHALL report an
invalid range without starting a job. A range SHALL be sent to the printer as output
page ranges: sheet *n* SHALL cover output pages `2n-1` and `2n` for a two-up binding,
and page *n* for margins-only. Adjacent sheets SHALL be coalesced into as few ranges
as possible.

#### Scenario: Printing everything

- **WHEN** the scope is the whole document
- **THEN** every output page of the built booklet is printed, in built order

#### Scenario: Printing a range of sheets

- **WHEN** the user asks for sheets `2-4` of a two-up job
- **THEN** output pages 3 through 8 are printed as a single range

#### Scenario: A scattered range

- **WHEN** the user asks for sheets `1, 4-5`
- **THEN** two ranges are sent — output pages 1–2 and 7–10 — not four

#### Scenario: A range in a margins-only job

- **WHEN** margins-only is the method and the user asks for `3-6`
- **THEN** the field is labelled in pages and output pages 3 through 6 are printed

#### Scenario: A range outside the job

- **WHEN** the user asks for sheet 30 of a 20-sheet job
- **THEN** the range is reported invalid and no job is started

### Requirement: One-click printing of the sheet on show

When a printer has been saved, the preview caption SHALL offer a control that prints
the physical sheet currently on show — both its front and its back — with the saved
preferences and no dialog. The control SHALL name the printer that will receive the
job. Until a printer has been saved the control SHALL open the print panel instead of
printing, so that no job is ever sent silently before the user has chosen a printer
at least once.

#### Scenario: Reprinting the sheet on screen

- **WHEN** a printer has been saved and the user activates the caption's print
  control while viewing the back of sheet 7
- **THEN** both sides of sheet 7 — output pages 13 and 14 — are sent to the saved
  printer with the saved options, and no dialog is shown

#### Scenario: Before a printer has been chosen

- **WHEN** no printer has been saved and the user activates the control
- **THEN** the print panel opens and nothing is printed

#### Scenario: The control names its destination

- **WHEN** a printer has been saved
- **THEN** the control identifies the printer the job will go to

#### Scenario: One click in a margins-only job

- **WHEN** the method is margins-only and the user prints the page on show
- **THEN** that single output page is printed

### Requirement: The system dialog remains available

The panel SHALL offer the platform's own print dialog as a secondary path, for
driver settings the panel does not carry. Choosing it SHALL print through the
platform dialog, and SHALL NOT save any preference, since the platform does not
report back what was chosen there. The panel SHALL make that clear.

#### Scenario: Printing through the platform dialog

- **WHEN** the user chooses the system dialog
- **THEN** the platform's print dialog appears for the built booklet

#### Scenario: The platform dialog changes nothing

- **WHEN** the user prints through the platform dialog and reopens the panel
- **THEN** the saved preferences are the ones from before

### Requirement: The renderer never touches the printer or the file system

The renderer SHALL reach printing only through the preload bridge: listing printers,
sending bytes with options, and reading or writing print preferences. The renderer
SHALL NOT gain file-system access, node integration, or a relaxed content-security
policy in order to print, and the print window SHALL NOT load any remote origin.

#### Scenario: Printing under the production policy

- **WHEN** the packaged application prints
- **THEN** the job succeeds with context isolation and sandboxing on, and no
  content-security-policy violation is reported

#### Scenario: No new network origin

- **WHEN** a print job runs
- **THEN** no request leaves the machine

### Requirement: Printing in the browser build

When the application runs without its desktop bridge, the Print action SHALL fall
back to the browser's own print of the built booklet, and the print panel, the saved
preferences, and the caption's per-sheet control SHALL NOT be offered.

#### Scenario: Printing from the web build

- **WHEN** the user activates Print with no desktop bridge present
- **THEN** the browser's print dialog opens on the built booklet

#### Scenario: Desktop-only affordances are absent

- **WHEN** the application runs without the desktop bridge
- **THEN** no print panel opens and the caption offers no per-sheet print control
