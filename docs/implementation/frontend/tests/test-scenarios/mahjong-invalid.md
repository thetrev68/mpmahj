# Test Scenario: Invalid Mahjong Declaration

**User Story**: US-030 (Error Handling)
**Component Specs**: MahjongDialog.md, ErrorDisplay.md
**Fixtures**: `playing-drawing.json`, `invalid-mahjong.json`

## Setup (Arrange)

- User attempts to declare Mahjong with an invalid hand.

## Steps (Act)

1. User sends `DeclareMahjong`.
2. Server emits `HandValidated` with `valid: false`.
3. Server emits `HandDeclaredDead` with reason.

## Expected Outcome (Assert)

- Hand marked dead and cannot win.
- UI shows error and disables Mahjong actions.
