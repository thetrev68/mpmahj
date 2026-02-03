# Test Scenario: History Jump (View Past Move)

**User Story**: US-025 - History Navigation
**Fixtures**: `history-list.json`

## Setup

- Game with multiple moves recorded
- History panel open with move list displayed

## Test Flow (Act & Assert)

1. **When**: History panel showing all 25 moves
2. **User action**: Clicks "Jump to Move 15"
3. **Send**: `JumpToMove { move_index: 15 }`
4. **Receive**: `StateRestored { mode: History, state: {...} }`
5. **Assert**:
   - Board displays game state at move 15
   - Move 15 highlighted in history panel
   - UI in view-only mode (no action buttons)
   - Moves 16-25 not yet displayed on board
6. **User navigates**: Can click other moves to jump to them
7. **User exits**: Clicks "Return to Current" or game board
8. **UI returns**: To current game state, action buttons re-enabled

## Success Criteria

- ✅ JumpToMove command sent with correct move index
- ✅ StateRestored event received with past game state
- ✅ Board displays correct state for move 15
- ✅ Move 15 highlighted in history panel
- ✅ View-only mode active (no actions allowed)
- ✅ Can navigate to other past moves
- ✅ Can return to current state

## Error Cases

### Invalid move index

- **When**: User attempts to jump to move 100 (only 25 moves)
- **Expected**: Request rejected or clamped to max move
- **Assert**: UI shows error or jumps to last available move

### Jump during action

- **When**: User tries to jump to past move while action dialog open
- **Expected**: Dialog closes, history view shown
- **Assert**: View-only mode prevents any actions
