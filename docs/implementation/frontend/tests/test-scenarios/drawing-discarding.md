# Test Scenario: Drawing and Discarding (Standard Turn Flow)

**User Story**: US-009 (Drawing) & US-010 (Discarding)
**Fixtures**: `playing-drawing.json`, `turn-flow-sequence.json`

## Setup

- Game state: Playing, Drawing stage
- User seated as: South (current turn)
- Player hand: 13 tiles (no winning patterns)
- Wall tiles remaining: 72 tiles
- Turn timer: 30 seconds

## Test Flow (Act & Assert)

1. **When**: South's turn, Drawing stage
2. **UI shows**: "Your Turn" highlight, "Draw Tile" button enabled, 30s timer
3. **User action**: Clicks "Draw Tile" button
4. **Send**: `DrawTile` command
5. **Receive**: `TileDrawnPublic { remaining_tiles: 71 }`
6. **Receive**: `TileDrawnPrivate { tile: 5Bam }`
7. **Assert**: Drawn tile appears in hand (highlighted), hand now 14 tiles
8. **Turn stage**: Advances to Discarding, "Discard Tile" button enabled
9. **User selects**: Tile at index 7 ("3 Crak") for discard
10. **Button updates**: Shows "Discard 3 Crak", selection border applied
11. **User action**: Clicks "Discard Tile" button
12. **Send**: `DiscardTile { tile: 3Crak }`
13. **Receive**: `TileDiscarded { player: South, tile: 3Crak }`
14. **Assert**: Tile disappears from hand (13 remaining), appears in discard pile
15. **Receive**: `CallWindowOpened { tile: 3Crak, discarded_by: South, timer: 5 }`
16. **Call window**: Appears for other players
17. **Receive**: `CallWindowClosed` event (no one called)
18. **Receive**: `TurnChanged { player: West, stage: Drawing }`
19. **UI updates**: "West's turn", ActionBar disabled for South

## Success Criteria

- ✅ Drew tile from wall (71 remaining)
- ✅ Hand temporarily 14 tiles
- ✅ Discarded 1 tile, returned to 13
- ✅ Discarded tile visible in pile
- ✅ Turn advanced to West (next player)
- ✅ Call window opened and closed
- ✅ Event sequence: DrawTile → TileDrawnPublic/Private → DiscardTile → TileDiscarded → CallWindowOpened/Closed → TurnChanged

## Error Cases

### Drawing out of turn

- **When**: User clicks "Draw Tile" when not their turn
- **Expected**: Button disabled
- **Assert**: ActionBar disables when `currentTurn !== userSeat`

### Timer expires during drawing

- **When**: User doesn't draw within 30 seconds
- **Expected**: Server auto-draws and auto-discards random tile
- **Assert**: Client receives TileDrawnPublic/Private + TileDiscarded, shows "Auto-played due to timeout"

### Wall depleted

- **When**: Wall has 0 drawable tiles remaining
- **Expected**: Server transitions to GameOver (Draw/Goulash)
- **Assert**: Client receives GameOver event with outcome
