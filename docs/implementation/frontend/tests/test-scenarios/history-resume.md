# Test Scenario: History Resume (Return to Present)

**User Story**: US-026 (History Navigation)
**Component Specs**: HistoryPanel.md
**Fixtures**: `history-list.json`

## Setup (Arrange)

- User is currently viewing a past move.

## Steps (Act)

1. User sends `ReturnToPresent`.
2. Server emits `StateRestored` with mode `Present`.

## Expected Outcome (Assert)

- UI returns to live game state.
