# editorial-design-system Specification

## Purpose

The editorial design system is the visual foundation of the Perfect Binding
renderer: bundled typefaces, colour tokens, a modular type scale, hairline rules in
place of drop shadows, and a single styling contract every control conforms to. It
gives the app the print-shop, magazine-grade character of the craft it performs, and
it is the layer the app shell composes against.

## Requirements

### Requirement: Bundled typefaces

The renderer SHALL load its typefaces from files bundled with the application and
SHALL NOT request a font from any external host. A grotesque family SHALL be used
for the wordmark, controls, labels, and numeric values; a serif family SHALL be
used for editorial copy — the cover headline, standfirst, descriptions, hints, and
the preview caption. Every `@font-face` SHALL declare `font-display: swap` and every
family SHALL be followed by a system fallback stack.

#### Scenario: Fonts load in the packaged app

- **WHEN** the packaged Electron app opens a document under the production CSP
  (`default-src 'self'`, no `font-src`)
- **THEN** both typefaces render, no request is made to an external host, and no
  CSP violation is reported in the console

#### Scenario: Fonts load offline and on every platform

- **WHEN** the app runs with no network connection, on macOS, Windows, or Linux
- **THEN** the interface renders in the bundled typefaces, identically on each
  platform

#### Scenario: Text is readable before the fonts arrive

- **WHEN** the stylesheet has applied but a font file has not yet decoded
- **THEN** text is painted in the declared fallback stack rather than being
  invisible

#### Scenario: Licences ship with the fonts

- **WHEN** the font files are added to the repository
- **THEN** their licence text is present in the same directory and the README
  records the families and their licence

### Requirement: Colour tokens

The stylesheet SHALL define the full palette as custom properties on `:root` —
paper, surface, three ink levels, two rule weights, one spot colour, and a danger
colour — and SHALL redefine only those tokens under
`@media (prefers-color-scheme: dark)`. No colour used by a rule may be declared
only inside the dark block. Components SHALL reference tokens and SHALL NOT hard-code
colour values.

#### Scenario: Light palette is the default

- **WHEN** the OS is set to a light theme or expresses no preference
- **THEN** the window renders as near-black ink on off-white paper

#### Scenario: Dark palette on OS preference

- **WHEN** the OS is set to a dark theme
- **THEN** every surface, ink level, rule, and the spot colour switch to their dark
  values, and no element is left rendering a light-palette colour

#### Scenario: Text contrast meets AA

- **WHEN** any text token is measured against the ground it is painted on, in
  either palette
- **THEN** body and heading text reach at least 4.5:1, and text used only for
  uppercase labels and captions reaches at least 4.5:1 at its rendered size

#### Scenario: The spot colour marks state, not decoration

- **WHEN** the interface is at rest with a binding method selected
- **THEN** the spot colour appears only on the selected control, the focus ring, and
  the progress indicator, and nowhere else

### Requirement: Typographic scale

The stylesheet SHALL define a modular type scale as custom properties and SHALL size
every text element from it. Uppercase tracked labels SHALL be reserved for section
titles and statistic keys. Numbers that update in place SHALL use
`font-variant-numeric: tabular-nums`.

#### Scenario: Hierarchy is legible at a glance

- **WHEN** a user looks at the section column
- **THEN** section titles, control labels, values, and hints are distinguishable by
  size, weight, and family without relying on colour alone

#### Scenario: Changing numbers do not reflow

- **WHEN** a slider is dragged, or the sheet count changes as settings change
- **THEN** the digits beside it change width-for-width and the surrounding layout
  does not shift

### Requirement: Rules instead of shadows

Panels, cards, controls, and sections SHALL be separated by 1px hairline rules and
borders in the rule tokens. Drop shadows SHALL be used in exactly one place: the
sheet in the preview, to read as a physical sheet of paper. Corner radii SHALL be
at most 3px.

#### Scenario: Interface at rest

- **WHEN** any screen is displayed
- **THEN** the only shadowed element is the previewed sheet, and every other
  boundary is a hairline rule

### Requirement: Control styling contract

Every control SHALL be restyled to the system — select, slider, segmented control,
switch, button, and binding card — while keeping its existing behaviour, its
accessible name, and its ARIA state attributes. Every interactive element SHALL show
a visible focus indicator in the spot colour on keyboard focus.

#### Scenario: Keyboard traversal is visible

- **WHEN** a user tabs through the section column
- **THEN** each focused control shows a spot-coloured focus ring against its ground

#### Scenario: Selected state is announced and visible

- **WHEN** a binding method is selected
- **THEN** its card carries `aria-pressed="true"` and is distinguished visually by
  its border and ground, not by colour alone

#### Scenario: Disabled controls read as unavailable

- **WHEN** a control is disabled — export before a build completes, the crop panel
  before margins are measured
- **THEN** it is visibly muted and does not respond to pointer or keyboard
  activation
