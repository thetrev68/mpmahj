# Test Scenario: Dead Hand - Invalid Tile Count

**User Story**: US-020 - Error Handling (Tile Count)
**Fixtures**: `game-states/dead-hand-wrong-count.json`

## Setup

- Game state: Playing, user's turn to declare Mahjong
- User seated as: East
- Player hand: 15 tiles (invalid count, should be 14)
- Pattern appears to match hand

## Test Flow (Act & Assert)

1. **When**: User reviews hand with 15 tiles (wrong count)
2. **User action**: Clicks "Declare Mahjong" button
3. **Send**: `DeclareMahjong { hand: [15 tiles], winning_tile: ... }`
4. **Server validates**: Expects 14 tiles, finds 15
5. **Receive**: `HandValidated { player: East, valid: false, reason: WrongTileCount }`
6. **Receive**: `HandDeclaredDead { player: East, reason: WrongTileCount }`
7. **UI displays**: Error message "Invalid Mahjong: wrong tile count (expected 14, found 15)"
8. **Assert**:
   - Player's hand marked as dead (grayed out)
   - "Declare Mahjong" button disabled
   - Player can still discard but cannot win
   - Other players see dead hand indicator
9. **Turn advances**: Game continues with remaining active players

## Success Criteria

- ✅ Invalid tile count detected on server
- ✅ HandValidated event received with valid: false
- ✅ HandDeclaredDead event received
- ✅ Error message displayed to user
- ✅ Dead hand indicator shown on board
- ✅ Mahjong button disabled for dead hand player
- ✅ Game continues with other players

## Error Cases

### 13 tiles (discarded without drawing)

- **When**: User has 13 tiles and tries to declare Mahjong
- **Expected**: Server rejects with WrongTileCount
- **Assert**: HandDeclaredDead event with reason WrongTileCount

### Server-client desync

- **When**: Counts differ between client and server
- **Expected**: Server is authoritative
- **Assert**: Server validation result takes precedence

### Mahjong during call window

- **When**: Called tile makes count 14, but hand still invalid
- **Expected**: Tile count validation includes called tile
- **Assert**: If count still wrong, HandDeclaredDead triggered
