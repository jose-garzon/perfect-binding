## MODIFIED Requirements

### Requirement: Control styling contract

Every control SHALL be restyled to the system — select, slider, segmented control,
switch, button, binding card, view switch, and contact-sheet thumbnail — while
keeping its existing behaviour, its accessible name, and its ARIA state attributes.
Every interactive element SHALL show a visible focus indicator in the spot colour on
keyboard focus. A contact-sheet thumbnail SHALL distinguish its kept, selected, and
removed states with hairline borders, ground tints, and a rule through the page —
never by colour alone — and SHALL keep the page legible when it is selected.

#### Scenario: Keyboard traversal is visible

- **WHEN** a user tabs through the section column
- **THEN** each focused control shows a spot-coloured focus ring against its ground

#### Scenario: Selected state is announced and visible

- **WHEN** a binding method is selected
- **THEN** its card carries `aria-pressed="true"` and is distinguished visually by
  its border and ground, not by colour alone

#### Scenario: Thumbnail states are distinguishable

- **WHEN** a contact sheet holds kept, selected, and removed pages
- **THEN** each state is told apart by border, ground, and the strike rule as well as
  by colour, and each thumbnail carries its state as an ARIA attribute

#### Scenario: Disabled controls read as unavailable

- **WHEN** a control is disabled — export before a build completes, the crop panel
  before margins are measured
- **THEN** it is visibly muted and does not respond to pointer or keyboard
  activation
