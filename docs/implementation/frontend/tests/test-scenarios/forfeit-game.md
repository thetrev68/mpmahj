# Test Scenario: Forfeit Game

**User Story**: US-032 - Forfeit Game
**Fixtures**: `playing-mid-game.json`, `forfeit-sequence.json`

## Setup

- Game state: Playing, mid-game
- User seated as: South
- Current turn: East (not user's turn)
- Player hand: 13 tiles (no winning patterns)
- Discard pile: 25 tiles

## Test Flow (Act & Assert)

1. **When**: Game is Playing, user clicks "Forfeit Game" button
2. **Dialog**: Shows "Forfeit Game? Are you sure?"
3. **User selects**: Reason "Poor connection" from dropdown
4. **Send**: `ForfeitGame { reason: PoorConnection }`
5. **Receive**: `PlayerForfeited { player: South, reason: PoorConnection, remaining_players: [East, West, North] }`
6. **Assert**:
   - User's hand marked as dead (grayed out)
   - User cannot make any moves (buttons disabled)
   - Game continues with 3 remaining players
7. **User can**: Spectate or leave game
8. **Other players**: Receive `PlayerForfeited` notification, continue playing

## Success Criteria

- ✅ Forfeit dialog opened and closed correctly
- ✅ User selected forfeit reason
- ✅ ForfeitGame command sent with reason
- ✅ User's hand marked as dead
- ✅ User cannot make moves
- ✅ Game continues with 3 remaining players
- ✅ Other players notified via PlayerForfeited event

## Error Cases

### Server rejects forfeit (invalid state)

- **When**: Server receives forfeit in invalid state
- **Expected**: Server rejects via `CommandRejected`
- **Assert**: Forfeit fails, dialog shows error, user remains in game

### WebSocket disconnect during forfeit

- **When**: Connection lost after clicking "Forfeit"
- **Expected**: On reconnect, client syncs to forfeited state
- **Assert**: If accepted, user sees "You forfeited" overlay; if rejected, can try again

### Attempting to forfeit during call window

- **When**: Call window is open, user tries to forfeit
- **Expected**: "Forfeit Game" button disabled during call resolution
- **Assert**: Button remains disabled until call window closes
