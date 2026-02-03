# Test Scenario: Charleston Standard Pass (First Right)

**User Story**: US-002 - Charleston First Right
**Fixtures**: `charleston-first-right.json`, `charleston-pass-sequence.json`

## Setup

- **Game state**: Load `fixtures/game-states/charleston-first-right.json`
- **Mock WebSocket**: Connected
- **User seated as**: East (dealer)
- **Player hand**: 13 tiles
- **Charleston stage**: FirstRight
- **Time remaining**: 45 seconds

## Test Flow

1. User sees "Charleston: First Right" header with 13 tiles and "Pass Tiles" button (disabled)
2. User clicks tile at index 0 ("2 Bam (1)") - Counter: "1/3 tiles selected"
3. User clicks tile at index 5 ("7 Crak (15)") - Counter: "2/3 tiles selected"
4. User clicks tile at index 10 ("Flower (34)") - Counter: "3/3 tiles selected", button enabled
5. User deselects tile at index 5 - Counter: "2/3", button disabled
6. User selects tile at index 7 ("White Dragon (33)") - Counter: "3/3", button enabled
7. User clicks "Pass Tiles" button
8. WebSocket sends `PassTiles { stage: "FirstRight", tiles: [tile0, tile7, tile10] }`
9. WebSocket receives `TilesPassed { player: "East", tiles: [...] }`
10. UI removes 3 tiles from hand (now 10 tiles)
11. WebSocket receives `TilesReceived { player: "East", tiles: [newTile1, newTile2, newTile3] }`
12. UI adds 3 tiles to hand (now 13 tiles)
13. WebSocket receives `CharlestonPhaseChanged { stage: "FirstAcross" }`
14. UI proceeds to FirstAcross pass

## Expected Outcome

- ✅ Successfully passed 3 tiles to the right
- ✅ Received 3 tiles from the left
- ✅ Hand remained at 13 tiles
- ✅ Charleston advanced to FirstAcross
- ✅ WebSocket command/event sequence correct
- ✅ No Jokers were passed

## Error Cases

### Attempting to Pass Jokers

- **When**: User selects a Joker tile
- **Expected**: Joker tile disabled, cannot be selected
- **Assert**: Joker tiles have `disabled` attribute

### Timer Expiry

- **When**: User does not select tiles within 45 seconds
- **Expected**: Server auto-selects 3 random non-Joker tiles
- **Assert**: Client receives `TilesPassed` event, shows "Auto-passed due to timeout"

### WebSocket Disconnect During Selection

- **When**: Connection lost while user has 2/3 tiles selected
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**: On reconnect, state restored or server's auto-pass received
