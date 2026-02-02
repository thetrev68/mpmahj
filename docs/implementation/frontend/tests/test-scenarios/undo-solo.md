# Test Scenario: Smart Undo (Solo/Practice)

**User Story**: US-040 (Smart Undo)
**Component Specs**: UndoButton.md, HistoryPanel.md
**Fixtures**: `playing-drawing.json`, `undo-solo.json`

## Setup (Arrange)

- Practice mode enabled.

## Steps (Act)

1. User performs a move (draw + discard).
2. User sends `SmartUndo`.
3. Server emits `StateRestored`.

## Expected Outcome (Assert)

- Game rewinds to previous decision point.
- UI updates to restored state.
