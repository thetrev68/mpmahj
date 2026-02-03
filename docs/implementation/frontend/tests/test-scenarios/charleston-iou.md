# Test Scenario: Charleston IOU (All Blind Pass)

**User Story**: US-008 - Charleston IOU Edge Case
**Fixtures**: `charleston-iou.json`, `charleston-iou-sequence.json`

## Setup

- **Game state**: Load `fixtures/game-states/charleston-iou.json`
- **Mock WebSocket**: Connected
- **User seated as**: North
- **Player hand**: 13 tiles
- **Charleston stage**: FirstLeft (all players will blind pass)
- **Time remaining**: 45 seconds
- **Special**: All 4 players choose blind pass, creating IOU scenario

## Background: IOU Concept

An IOU occurs during blind passing when all players choose different pass counts (1s and 2s), creating an asymmetric exchange where some players receive fewer tiles than they passed. Server tracks debt and settles via wall tiles.

## Test Flow

1. User selects "Blind Pass" option on FirstLeft
2. User selects 2 tiles (indices 5, 9)
3. User clicks "Confirm Blind Pass"
4. WebSocket sends `PassTiles { stage: "FirstLeft", tiles: [tile5, tile9], blind_pass_count: 1 }`
5. UI shows "All players chose blind pass" notification
6. UI displays "IOU mode active" indicator
7. WebSocket receives `BlindPassPerformed` events:
   - East: 1 blind, 2 hand count
   - South: 2 blind, 1 hand count
   - West: 1 blind, 2 hand count
   - North (user): 1 blind, 2 hand count
8. Exchange pattern (First Left = pass left, receive from right):
   - North sends 2 left → receives 2 from West
   - West sends 2 left → receives 1 from South
   - South sends 1 left → receives 2 from East
   - East sends 2 left → receives 2 from North
9. WebSocket receives `TilesReceived { player: "North", tiles: [westTile1, westTile2] }`
10. Hand: 13 tiles (balanced)
11. WebSocket receives `IOUDetected { debts: [("West", 1)] }`
12. WebSocket receives `IOUResolved { summary: "West received 1 tile from wall" }`
13. UI shows "IOU settlement complete"
14. WebSocket receives `CharlestonPhaseChanged { stage: "VotingToContinue" }`
15. UI shows summary: "First Charleston complete, IOU settlements: West +1"

## Expected Outcome

- ✅ All 4 players executed blind pass
- ✅ Asymmetric exchange created IOU (West -1)
- ✅ Server resolved IOU, West received 1 from wall
- ✅ All players ended with 13 tiles
- ✅ Charleston advanced to Voting
- ✅ UI displayed IOU indicator and settlement
- ✅ Event sequence correct

## Error Cases

### Multiple IOUs Simultaneously

- **When**: All players choose different counts (East: 1, South: 2, West: 1, North: 2)
- **Expected**: Server handles multiple debts: East -1, South +1, West -1, North +1
- **Assert**: All players end with 13 tiles

### IOU When Wall Nearly Empty

- **When**: IOU occurs but <4 tiles remain in wall
- **Expected**: Server draws available tiles; if wall exhausted, declares Wall Game
- **Assert**: IOU settlement doesn't crash

### Balanced Exchange (No IOU)

- **When**: All 4 players pass exactly 1 tile each via blind pass
- **Expected**: Circular exchange, everyone receives 1, no IOU needed
- **Assert**: IOU logic doesn't trigger

### Reconnect During IOU Settlement

- **When**: User disconnects after blind pass, reconnects during settlement
- **Expected**: Server sends full state including pending IOU
- **Assert**: UI syncs to correct post-settlement state
