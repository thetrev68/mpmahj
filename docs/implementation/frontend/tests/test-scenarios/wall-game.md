# Test Scenario: Wall Game - Draw from Exhausted Wall

**User Story**: US-021 (Wall Game - Draw)
**Fixtures**: `game-states/wall-near-empty.json`

## Setup (Arrange)

- Game state: Playing phase (near game end)
- Mock WebSocket: Connected
- User seated as: South (seat 1)
- Wall has exactly 1 tile remaining
- Current turn: East player
- No player has declared Mahjong yet

## Test Flow (Act & Assert)

### Happy Path: Wall Exhaustion Results in Draw

1. **When**: East draws last tile from wall (1 tile remaining)
2. **Send**: `DrawTile` (East player's turn)
3. **Receive**: `TileDrawn` event:
   - `player: East`
   - `tile: Tile(X)`
   - `wall_count: 0` (wall now empty)
4. **Discard Phase**: East discards tile, no one calls
5. **Next Turn Would Be**: South, but must draw
6. **Receive**: `GameOver` event with:
   - `outcome: WallExhausted`
   - `winner: None`
   - `scores: { East: 0, South: 0, West: 0, North: 0 }`
7. **Assert**:
   - Game ends in draw (no winner)
   - All scores are 0
   - Wall state shows 0 tiles
   - Game transitions to GameOver state

## Error Cases

### Error: Last tile drawn and completes winning hand

- **When**: East draws last tile, it completes a winning pattern
- **Send**: `DeclareMahjong { player: East, pattern: ... }`
- **Expected**: East wins before wall exhaustion
- **Receive**: `MahjongDeclared` event, then `GameOver { winner: East }`
- **Assert**: Mahjong takes precedence over wall exhaustion

### Error: Last tile called for Pung (non-winning)

- **When**: East discards last tile, South calls for Pung
- **Send**: `DeclareCallIntent { player: South, intent: Pung, discard_index: ... }`
- **Receive**: `MeldCreated` event, South's turn with 14 tiles
- **After discard**: South has 13 tiles, next player needs to draw
- **Receive**: `GameOver { outcome: WallExhausted, winner: None }`
- **Assert**: Wall game proceeds after non-winning melds

### Error: Disconnect at wall exhaustion

- **When**: User disconnects as game ends with wall exhaustion
- **Receive on reconnect**: `GameStateSnapshot` with `state: GameOver`
- **Assert**: Game end is persisted server-side, client receives final state

## Success Criteria

- ✅ Wall exhausted (0 tiles remaining after last draw)
- ✅ No player declared Mahjong
- ✅ GameOver event received with outcome = WallExhausted
- ✅ All player scores are 0 (draw)
- ✅ Game state transitions to GameOver
- ✅ Event sequence correct (DrawTile → GameOver)
