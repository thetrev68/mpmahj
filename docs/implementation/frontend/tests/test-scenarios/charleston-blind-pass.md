# Test Scenario: Charleston Blind Pass

**User Story**: US-004 - Charleston Blind Pass/Steal
**Fixtures**: `charleston-first-left.json`, `charleston-blind-pass-sequence.json`

## Setup

- **Game state**: Load `fixtures/game-states/charleston-first-left.json`
- **Mock WebSocket**: Connected
- **User seated as**: South
- **Player hand**: 13 tiles
- **Charleston stage**: FirstLeft (final pass of First Charleston)
- **Time remaining**: 45 seconds

## Test Flow

1. User sees "Charleston: First Left" header with two options: "Pass 3 Tiles" and "Blind Pass"
2. User clicks "Blind Pass" button
3. UI shows "Select 1 or 2 tiles to exchange" with counter "0/2 tiles selected (min: 1)"
4. User selects tile at index 3 (Counter: "1/2"); "Confirm Blind Pass" button enabled
5. User selects tile at index 8 (Counter: "2/2")
6. User clicks "Confirm Blind Pass" button
7. WebSocket sends `PassTiles { stage: "FirstLeft", tiles: [tile3, tile8], blind_pass_count: 1 }`
8. WebSocket receives `TilesPassed { player: "South", tiles: [...] }`
9. UI removes 2 tiles from hand (now 11 tiles)
10. WebSocket receives `TilesReceived { player: "South", tiles: [opponentTile1, opponentTile2, opponentTile3] }`
11. UI adds 3 tiles to hand (now 13 tiles)
12. WebSocket receives `CharlestonPhaseChanged { stage: "VotingToContinue" }`
13. UI transitions to Voting phase

## Expected Outcome

- ✅ Successfully executed blind pass with 2 tiles
- ✅ Received 3 tiles from opponent
- ✅ Hand remained at 13 tiles
- ✅ Charleston advanced to Voting stage
- ✅ No Jokers were passed

## Error Cases

### Attempting to Blind Pass Jokers

- **When**: User selects a Joker during blind pass
- **Expected**: Joker tile disabled, cannot be selected
- **Assert**: Joker tiles have `disabled` attribute

### Blind Pass on Wrong Stage

- **When**: User is on FirstRight or FirstAcross (not FirstLeft/SecondRight)
- **Expected**: "Blind Pass" button not shown
- **Assert**: Blind pass UI only renders when `stage === 'FirstLeft' || stage === 'SecondRight'`

### Timer Expiry During Selection

- **When**: User selects 1 tile but doesn't confirm within time limit
- **Expected**: Server auto-confirms with selected tiles
- **Assert**: Client receives `BlindPassPerformed` and `TilesPassed` events
