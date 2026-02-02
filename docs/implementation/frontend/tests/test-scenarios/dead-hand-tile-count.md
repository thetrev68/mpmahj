# Test Scenario: Dead Hand - Invalid Tile Count

**User Story**: US-030 (Error Handling)
**Component Specs**: ErrorDisplay.md, GameBoard.md
**Fixtures**: `game-states/dead-hand-wrong-count.json`

## Setup (Arrange)

- Game state: Playing phase, user's turn to declare Mahjong
- Mock WebSocket: connected
- User seated as: East (seat 0)
- Player hand contains: 15 tiles (invalid count)
- Pattern on card appears to match current hand

## Steps (Act)

1. User reviews their hand and believes they have Mahjong
2. User clicks "Declare Mahjong" button in ActionBar
3. Client sends `DeclareMahjong` command to server
4. Server validates tile count: expects 14, finds 15
5. Server responds with `HandValidated` event with `valid: false`
6. Server emits `HandDeclaredDead` event with reason: "WrongTileCount"
7. UI displays error notification
8. Player is marked with dead hand status
9. UI updates to show dead hand indicator on player's board position
10. Turn advances to next player

## Expected Outcome (Assert)

- Error message displayed: "Invalid Mahjong declaration: wrong tile count (expected 14, found 15)"
- Player's hand UI shows dead hand indicator (grayed out or marked)
- "Declare Mahjong" button becomes disabled for this player
- Player can still discard tiles normally but cannot win
- Game continues with remaining active players
- Dead hand player's tiles are still visible to them but marked as inactive
- Other players see dead hand indicator on that player's position

## Error Cases

- **15 tiles (drew but didn't discard)**: Should detect immediately on Mahjong attempt
- **13 tiles (discarded without drawing)**: Should detect on Mahjong attempt
- **16+ tiles (multiple erroneous draws)**: Should ideally be caught earlier by state validation
- **Server-client desync**: If counts differ between client and server, server is authoritative
- **Mahjong during call window**: Should validate tile count includes called tile

## Cross-References

- **Related Scenarios**: `mahjong-invalid.md` (other invalid Mahjong conditions)
- **Component Tests**: ErrorDisplay component should render tile count errors
- **Integration Tests**: Full turn flow with tile count validation
- **Manual Testing**: User Testing Plan - Error Handling section
