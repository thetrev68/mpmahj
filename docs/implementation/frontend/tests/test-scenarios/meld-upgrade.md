# Test Scenario: Meld Upgrade (Pung → Kong → Quint)

**User Story**: US-016 (Meld Upgrades)
**Component Specs**: ExposedMeldsDisplay.md, ActionBar.md
**Fixtures**: `playing-drawing.json`, `exposed-melds.json`

## Setup (Arrange)

- User has an exposed Pung and the matching tile in hand.
- It is the user's Discarding stage.

## Steps (Act)

1. User selects exposed meld to upgrade.
2. User sends `AddToExposure` with `meld_index` and `tile`.
3. Server emits `MeldUpgraded` event.

## Expected Outcome (Assert)

- Meld type updates (Pung → Kong → Quint if repeated).
- Replacement draw occurs when required.

## Error Cases

- Attempting upgrade out of turn is rejected.
