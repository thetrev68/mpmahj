# Test Scenario: Wall Closure Rule

**User Story**: US-017 - Wall Closure Rule
**Fixtures**: `playing-wall-closure.json`

## Setup (Arrange)

- Game state: Playing phase
- User seated as: East
- Wall tiles remaining: 14 tiles (at closure threshold)
- Dead wall: 14 tiles (reserved)
- Game phase: Playing

## Test Flow (Act & Assert)

### Scenario: Wall Reaches Closure During User's Turn

1. **Initial state**: Wall has 14 drawable tiles remaining
2. **South's turn**: Draws tile, discards
3. **Receive**: `TileDrawnPublic { remaining_tiles: 13 }`
4. **West's turn**: Draws tile, discards
5. **Receive**: `TileDrawnPublic { remaining_tiles: 12 }`
6. **North's turn**: Draws tile, discards
7. **Receive**: `TileDrawnPublic { remaining_tiles: 11 }`
8. **User's turn (East)**: Attempts to draw
9. **Send**: `DrawTile { player: East }`
10. **Server check**: Wall down to last few tiles
11. **Receive**: `TileDrawn { player: East, tile: 42 }`
12. **Receive**: `TileDrawnPublic { remaining_tiles: 10 }`
13. **User discards**: Send `DiscardTile { player: East, tile: 5 }`
14. **Continue play**: Game continues until wall fully exhausted

### Scenario: Wall Exhausted (No Tiles Left)

1. **Wall state**: 0 drawable tiles remaining
2. **Current player**: Attempts DrawTile
3. **Server rejects**: No tiles available to draw
4. **Receive**: `GameOver { outcome: WallExhausted, winner: None }`
5. **Assert**: Game ends in draw (wall game)

## Success Criteria

- ✅ Wall tile count decrements correctly with each draw
- ✅ Dead wall (14 tiles) never becomes drawable
- ✅ Game continues while drawable tiles remain
- ✅ GameOver triggered when wall exhausted
- ✅ Wall exhaustion results in draw outcome

## Error Cases

### Attempting to Draw from Empty Wall

- **When**: Wall has 0 drawable tiles, player sends DrawTile
- **Expected**: Command rejected
- **Receive**: `CommandError { reason: WallExhausted }`
- **Receive**: `GameOver { outcome: WallExhausted }`
- **Assert**: Game ends, no tile drawn

### Dead Wall Boundary Respected

- **When**: 14 tiles remain (all in dead wall)
- **Expected**: DrawTile triggers wall exhaustion
- **Receive**: `GameOver { outcome: WallExhausted }`
- **Assert**: Dead wall tiles never drawn

### Kong During Low Wall

- **When**: Wall has 15 tiles, player attempts Kong (requires replacement tile)
- **Expected**: Kong allowed, replacement drawn from wall
- **Receive**: `TileDrawn { replacement: true }`
- **Assert**: Replacement tiles drawn before wall closure

## Technical Notes

**Wall Structure**:

- Total tiles: 152
- Initial deal: 52 tiles (13 × 4 players)
- Charleston exchanges: No tiles consumed from wall
- Dead wall: 14 tiles (reserved for replacements)
- Drawable: 152 - 52 - 14 = 86 tiles initially

**Closure Threshold**:

- Wall closure occurs when drawable tiles = 0
- Dead wall boundary at 14 tiles
- Replacement tiles (Kong, Flower) drawn from dead wall during game
- When main wall depleted, game ends in draw
