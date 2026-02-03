# Test Scenario: View Move History

**User Story**: US-024 - View Move History
**Fixtures**: `playing-mid-game.json`, `history-sequence.json`

## Setup

- Game state: Playing, mid-game
- User seated as: East
- Current turn: South (not user's turn)
- Move history: 25 moves recorded from game start
- History panel: Closed initially

## Test Flow (Act & Assert)

1. **When**: Game is Playing with 25 moves recorded
2. **User action**: Clicks "History" button
3. **History panel opens**: Slides in from right, shows "Move History"
4. **Display**: Lists moves in reverse chronological order
   - Move 25: South discarded 7 Dot (2 min ago)
   - Move 24: South drew tile
   - Move 23: West discarded 3 Bam
   - ... (down to Move 1: East rolled dice)
5. **Each move shows**: Number, player, action, time, "Jump to Move" button
6. **User scrolls**: Views moves 1-25, scroll position preserved
7. **User filters**: Selects "Discards Only"
8. **Panel updates**: Shows only discard moves (25, 23, 20, ...)
9. **User closes**: Clicks "Close" button or clicks game board
10. **Panel closes**: Slides out, game board visible again

## Success Criteria

- ✅ History panel opened successfully
- ✅ All 25 moves displayed in reverse chronological order
- ✅ Each move shows: number, player, action, timestamp
- ✅ "Jump to Move" button present for each move
- ✅ Filter dropdown functional (All, Draws, Discards, Calls, Mahjong)
- ✅ Filtering updates view correctly
- ✅ Scroll position preserved when filtering
- ✅ Panel closes on "Close" button or game board click
- ✅ Game state unchanged (history is read-only)

## Error Cases

### No move history available

- **When**: Game is in Setup phase (no moves yet)
- **Expected**: History panel shows "No moves yet"
- **Assert**: History button disabled or panel shows empty state

### Jump to move in progress

- **When**: User clicks "Jump to Move 15"
- **Expected**: UI shows game state at that point
- **Assert**: Board state reflects move 15, subsequent moves not yet played

### Filter with no results

- **When**: User filters "Calls Only" but no calls recorded
- **Expected**: History panel shows "No moves matching filter"
- **Assert**: Filter dropdown resets or shows helpful message
