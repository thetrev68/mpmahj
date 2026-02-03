# Test Scenario: Smart Undo (Solo/Practice)

**User Story**: US-022 - Smart Undo Solo
**Fixtures**: `playing-drawing.json`, `undo-solo.json`

## Setup

- Game mode: Practice/Solo (no other players)
- User has just completed a move (drew tile, discarded, no call)

## Test Flow (Act & Assert)

1. **When**: User completed draw + discard move
2. **User action**: Clicks "Undo" button (visible in practice mode)
3. **Send**: `SmartUndo` command
4. **Receive**: `StateRestored { mode: Normal, state: {...} }`
5. **Assert**:
   - Game state rewinds to before draw
   - User's hand restored to pre-draw state (13 tiles)
   - Wall tiles incremented by 1 (tile returned)
   - Discarded tile removed from pile
   - Turn marker reset to user's turn (Drawing stage)
6. **UI updates**: Reflects restored state
7. **User can**: Redo move or select different action

## Success Criteria

- ✅ SmartUndo command sent
- ✅ StateRestored event received
- ✅ Game state rewound correctly
- ✅ Hand restored to 13 tiles
- ✅ Wall tile count incremented
- ✅ Discarded tile removed from pile
- ✅ Turn marker reset
- ✅ UI reflects restored state

## Error Cases

### Undo at start of game

- **When**: User tries to undo in Setup or early Charleston
- **Expected**: "Undo" button disabled
- **Assert**: Button only enabled after at least one move

### Undo with no moves remaining

- **When**: All moves have been undone
- **Expected**: "Undo" button disabled
- **Assert**: Button re-enables when moves available again

### Undo in multiplayer mode

- **When**: User attempts undo in game with other players
- **Expected**: "Undo" button disabled or hidden
- **Assert**: Solo undo only available in practice mode
