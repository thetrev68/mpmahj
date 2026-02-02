# Test Scenario: Smart Undo (Multiplayer Voting)

**User Story**: US-023 (Smart Undo Voting)
**Component Specs**: UndoVoteDialog.md, HistoryPanel.md
**Fixtures**: `playing-drawing.json`, `undo-vote.json`

## Setup (Arrange)

- Multiplayer game, undo requires unanimous vote.

## Steps (Act)

1. User sends `SmartUndo`.
2. Server emits `UndoRequested`.
3. Other players send `VoteUndo`.
4. Server emits `UndoVoteRegistered` for each vote.
5. If unanimous, server emits `StateRestored`.

## Expected Outcome (Assert)

- Undo is applied only with unanimous approval.
- UI shows vote progress and outcome.
