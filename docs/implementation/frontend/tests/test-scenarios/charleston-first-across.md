# Test Scenario: Charleston First Across Pass

**User Story**: US-003 - Charleston First Across
**Fixtures**: `charleston-first-across.json`

## Setup (Arrange)

- Game state: Charleston FirstAcross stage
- User seated as: East
- Player hand: 13 tiles (after First Right completed)
- Previous passes: First Right completed

## Test Flow (Act & Assert)

### Happy Path: First Across Pass

1. **When**: Charleston FirstAcross stage, user is East player with 13 tiles
2. **User selects**: 3 tiles to pass to West (tiles at indices 2, 8, 11)
3. **Send**: `PassTiles { player: East, tiles: [tile2, tile8, tile11], stage: FirstAcross }`
4. **Receive**: `TilesPassed { player: East, tiles: [tile2, tile8, tile11] }`
5. **Assert**: Hand reduces to 10 tiles (13 - 3)
6. **Receive**: `TilesReceived { player: East, tiles: [newTile1, newTile2, newTile3] }`
7. **Assert**: Hand returns to 13 tiles (10 + 3 new)
8. **Receive**: `CharlestonPhaseChanged { stage: FirstLeft }`
9. **Assert**: Charleston advances to next stage

## Error Cases

### Error: Passing Jokers

- **Send**: `PassTiles` with Joker in tiles array
- **Expected**: `CommandError::ContainsJokers`
- **Assert**: Hand unchanged, stage unchanged

### Error: Timer expiry

- **When**: User does not select/send tiles within timeout
- **Expected**: Server auto-selects 3 random non-Joker tiles
- **Receive**: `TilesPassed` event without user action
- **Assert**: Hand updated with auto-passed tiles

### Error: Wrong tile count

- **Send**: `PassTiles` with 2 tiles (wrong count)
- **Expected**: `CommandError::InvalidPassCount`
- **Assert**: Hand unchanged

## Success Criteria

- ✅ User passed 3 tiles to West
- ✅ User received 3 tiles from West
- ✅ Hand maintains 13 tiles total
- ✅ Charleston advanced to FirstLeft stage
- ✅ No Jokers were passed
- ✅ Event sequence correct (PassTiles → TilesPassed → TilesReceived → CharlestonPhaseChanged)
