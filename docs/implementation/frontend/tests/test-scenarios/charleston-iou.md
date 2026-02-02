# Test Scenario: Charleston IOU (All Blind Pass)

**User Story**: US-007 - Charleston IOU Edge Case
**Component Specs**: BlindPassPanel.md, IOUIndicator.md, CharlestonTracker.md
**Fixtures**: `charleston-iou.json`, `charleston-iou-sequence.json`
**Manual Test**: Manual Testing Checklist #7

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-iou.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: North
- **Player hand**: 13 tiles (during FirstLeft stage)
- **Charleston stage**: FirstLeft (final pass of First Charleston)
- **Time remaining**: 45 seconds
- **Special context**: All 4 players will choose blind pass option
- **IOU trigger**: Creates complex tile exchange requiring IOU tracking

## Background: What is an IOU?

In American Mahjong, an "IOU" occurs during blind passing when:

1. All players choose blind pass on the same stage
2. Players pass different numbers of tiles (mix of 1s and 2s)
3. Creates an asymmetric exchange where some players receive fewer tiles than they passed
4. Server must track the "debt" (IOU) and settle it by drawing tiles from the wall

This is a rare but valid edge case that tests the robustness of tile accounting.

## Steps (Act)

### Step 1: User chooses blind pass

- User sees "Charleston: First Left" with "Blind Pass" option
- User clicks "Blind Pass" button
- UI transitions to blind pass selection mode
- User selects 2 tiles (indices 5 and 9)
- User clicks "Confirm Blind Pass"
- WebSocket sends `PassTiles` command:
  - `stage: "FirstLeft"`
  - `tiles: [tileAt5, tileAt9]`
  - `blind_pass_count: 1`

### Step 2: All players execute blind pass

- WebSocket receives `BlindPassPerformed` event sequence:
  - `player: "East"`, `blind_count: 1`, `hand_count: 2`
  - `player: "South"`, `blind_count: 2`, `hand_count: 1`
  - `player: "West"`, `blind_count: 1`, `hand_count: 2`
  - `player: "North"` (user), `blind_count: 1`, `hand_count: 2`
- UI shows "All players chose blind pass" notification
- UI displays special IOU indicator: "IOU mode active"

### Step 3: Server processes asymmetric exchange

**Exchange pattern** (First Left = pass left, receive from right):

- North (user) passes 2 tiles left → East receives 2 from North
- East passes 2 tiles left → South receives 2 from East
- South passes 1 tile left → West receives 1 from South
- West passes 2 tiles left → North receives 2 from West

**Result**:

- East: passed 2, received 2 = balanced ✓
- South: passed 1, received 2 = +1 (owes nothing)
- West: passed 2, received 1 = -1 (IOU 1 tile)
- North (user): passed 2, received 2 = balanced ✓

### Step 4: User receives tiles from blind exchange

- WebSocket receives `TilesReceived` event:
  - `player: "North"`
  - `tiles: [westTile1, westTile2]` (received 2 from West)
- UI removes user's 2 passed tiles
- UI adds 2 new tiles from West
- User's hand: still 13 tiles (2 out, 2 in)
- No IOU for user (balanced exchange)

### Step 5: Server resolves IOU

- WebSocket receives `IOUDetected` event:
  - `debts: [("West", 1)]`
- WebSocket receives `IOUResolved` event:
  - `summary: "West received 1 tile from wall"`
- UI shows global notification: "IOU settlement complete"
- Charleston accounting complete: all players have 13 tiles

### Step 6: Charleston advances

- WebSocket receives `CharlestonPhaseChanged`:
  - `stage: "VotingToContinue"`
- UI shows summary:
  - "First Charleston complete"
  - "IOU settlements: West +1"
- Charleston transitions to Voting stage

### Step 7: Voting phase begins normally

- UI transitions to voting screen
- All players have 13 tiles (verified)
- Voting proceeds as normal (see `charleston-voting.md`)

## Expected Outcome (Assert)

- ✅ All 4 players executed blind pass successfully
- ✅ Asymmetric exchange created IOU condition
- ✅ Server correctly calculated IOU (West -1)
- ✅ Server resolved IOU and announced settlement
- ✅ All players ended with exactly 13 tiles
- ✅ Charleston advanced to Voting stage
- ✅ UI displayed IOU indicator and settlement notification
- ✅ WebSocket events correctly represented IOU flow

## Error Cases

### Complex IOU with multiple players

- **When**: Different blind pass counts create multiple IOUs
  - East: 1 tile, South: 2 tiles, West: 1 tile, North: 2 tiles
  - Pattern: East -1, South +1, West -1, North +1
- **Expected**:
  - Server issues `IOUDetected` then `IOUResolved` (summary includes both settlements)
  - All players end with 13 tiles
- **Assert**: Server can handle multiple simultaneous IOUs

### IOU when wall is nearly empty

- **When**: Late-game Charleston (rare) with IOU when wall has <4 tiles
- **Expected**:
  - Server draws available tiles from wall
  - If wall exhausted, game declares Wall Game (draw)
  - `GameOver` event with `outcome: "WallGame"`
- **Assert**: IOU settlement doesn't crash with empty wall

### All players blind pass 1 tile (no IOU)

- **When**: All 4 players pass exactly 1 tile each via blind pass
- **Expected**:
  - Circular exchange: everyone passes 1, receives 1
  - No IOU settlements needed
  - Charleston proceeds normally
- **Assert**: IOU logic doesn't trigger when exchange is balanced

### UI displays IOU status during exchange

- **When**: IOU is in progress (tiles passed but not yet settled)
- **Expected**:
  - UI shows temporary IOU indicator: "Settling tile counts..."
  - Spinner or loading state during settlement
  - Clear notification when settlement complete
- **Assert**: User understands temporary tile count imbalance

### Reconnect during IOU settlement

- **When**: User disconnects after blind pass, reconnects during IOU settlement
- **Expected**:
  - Server sends full state including pending IOU
  - Client receives `IOUSettlement` events on reconnect
  - UI syncs to correct post-settlement state
- **Assert**: Reconnection handles IOU state correctly

## Visual Design Notes

### IOU Indicator Component

When IOU is active, display a special indicator:

```text
┌─────────────────────────────┐
│  🔄 IOU Settlement Active   │
│  Balancing tile counts...   │
└─────────────────────────────┘
```

### Settlement Notification

When IOU settles:

```text
┌─────────────────────────────────────────┐
│  ✓ IOU Settlement Complete              │
│  West received 1 tile from wall         │
│  All players now have 13 tiles          │
└─────────────────────────────────────────┘
```

## Cross-References

### Related Scenarios

- [charleston-blind-pass.md](charleston-blind-pass.md) - Basic blind pass mechanics
- [charleston-standard.md](charleston-standard.md) - Standard pass for comparison
- [wall-game.md](wall-game.md) - Wall exhaustion edge case

### Related Components

- [BlindPassPanel](../../component-specs/charleston/BlindPassPanel.md)
- [IOUIndicator](../../component-specs/charleston/IOUIndicator.md)
- [CharlestonTracker](../../component-specs/charleston/CharlestonTracker.md)
- [PlayerStatusIndicator](../../component-specs/game/PlayerStatusIndicator.md)

### Backend References

- Command: `mahjong_core::command::PassTiles { blind_pass_count: Option<u8> }`
- Event: `mahjong_core::event::BlindPassPerformed`, `IOUDetected`, `IOUResolved`, `CharlestonPhaseChanged`
- State: `GameState::Charleston(CharlestonStage::FirstLeft)` with IOU tracking
- Logic: `mahjong_core::charleston::settle_iou()`

### Backend Implementation Notes

The backend's IOU settlement algorithm:

1. Collect all blind pass exchanges for the stage
2. Calculate net tile balance for each player (passed - received)
3. For each player with negative balance (owes tiles):
   - Draw abs(balance) tiles from wall
   - Emit `IOUSettlement` event
4. Verify all players have exactly 13 tiles
5. Emit `CharlestonStageComplete` event

See: `crates/mahjong_core/src/charleston.rs:settle_blind_pass_iou()`

### Accessibility Notes

- IOU mode announced: "All players chose blind pass. Tile exchange requires settlement."
- Settlement announced: "IOU settlement: West received 1 tile from wall."
- Final balance announced: "All players now have 13 tiles. Charleston stage complete."
- IOU indicator has sufficient color contrast and is screen-reader friendly
