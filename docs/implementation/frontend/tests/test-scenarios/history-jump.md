# Test Scenario: History Jump (View Past Move)

**User Story**: US-025 (History Navigation)
**Component Specs**: HistoryPanel.md
**Fixtures**: `history-list.json`

## Setup (Arrange)

- Game has multiple moves recorded.

## Steps (Act)

1. User sends `RequestHistory`.
2. Server emits `HistoryList`.
3. User sends `JumpToMove`.
4. Server emits `StateRestored` with mode `History`.

## Expected Outcome (Assert)

- UI shows past state in view-only mode.
