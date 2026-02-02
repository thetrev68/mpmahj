# Test Scenario: Declaring Mahjong (Self-Draw)

**User Story**: US-018 (Self-Draw Mahjong)
**Component Specs**: MahjongDialog.md, ActionBar.md
**Fixtures**: `playing-drawing.json`, `near-win-one-away.json`

## Setup (Arrange)

- User's turn, Drawing stage. Hand is one tile away from a valid pattern.

## Steps (Act)

1. User draws a tile that completes a valid pattern.
2. User sends `DeclareMahjong` with `hand` and `winning_tile`.
3. Server validates hand and emits `HandValidated`.
4. Server emits `MahjongDeclared` and `GameOver`.

## Expected Outcome (Assert)

- Mahjong is accepted without a call window.
- Scoring shown from `GameOver` result.

## Error Cases

- If hand is invalid, `HandDeclaredDead` is emitted.
