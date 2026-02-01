# Test Scenario: Charleston Blind Pass

**User Story**: US-004 - Charleston Blind Pass/Steal
**Component Specs**: BlindPassPanel.md, TileSelectionPanel.md, CharlestonTracker.md
**Fixtures**: `charleston-first-left.json`, `charleston-blind-pass-sequence.json`
**Manual Test**: Manual Testing Checklist #4

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-first-left.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: South
- **Player hand**: 13 tiles loaded from fixture
- **Charleston stage**: FirstLeft (final pass of First Charleston)
- **Time remaining**: 45 seconds (default timer)
- **Special context**: Last pass before voting - blind pass option available

## Steps (Act)

### Step 1: Verify Blind Pass UI is displayed

- User sees "Charleston: First Left" header
- User sees their 13 concealed tiles
- User sees two button options:
  - "Pass 3 Tiles" (standard pass)
  - "Blind Pass" (alternate option)
- User sees tooltip on "Blind Pass" explaining: "Exchange 1-2 tiles with opponent instead of passing 3"
- User sees countdown timer

### Step 2: User chooses Blind Pass option

- User clicks "Blind Pass" button
- UI transitions to blind pass selection mode
- UI shows "Select 1 or 2 tiles to exchange" instruction
- Counter shows "0/2 tiles selected (min: 1)"
- "Confirm Blind Pass" button appears (disabled initially)

### Step 3: User selects tiles for blind pass

- User clicks tile at index 3 (e.g., "5 Dot")
  - Tile highlights with selection border
  - Counter updates to "1/2 tiles selected"
  - "Confirm Blind Pass" button becomes enabled (minimum met)
- User clicks tile at index 8 (e.g., "North Wind")
  - Second tile highlights
  - Counter updates to "2/2 tiles selected"
- User attempts to select third tile at index 12
  - Click has no effect (max 2 tiles enforced)
  - Visual feedback: button shake or tooltip "Maximum 2 tiles for blind pass"

### Step 4: User submits blind pass

- User clicks "Confirm Blind Pass" button
- WebSocket sends `PassTiles` command with:
  - `stage: "FirstLeft"`
  - `tiles: [tileAt3, tileAt8]`
  - `blind: true`
- UI shows "Waiting for opponent's blind pass..." spinner
- Selection UI becomes disabled
- UI displays info message: "You will receive 1-2 tiles back"

### Step 5: Server processes blind exchange

- WebSocket receives `TilesPassed` event:
  - `player: "South"`
  - `stage: "FirstLeft"`
  - `tile_count: 2`
  - `blind: true`
- UI removes the 2 blind-passed tiles from user's hand
- UI shows "Waiting to receive tiles from opponent..."

### Step 6: User receives blind-passed tiles

- WebSocket receives `TilesReceived` event:
  - `player: "South"`
  - `tiles: [opponentTile1]` (opponent only passed 1 tile!)
- UI adds 1 new tile to user's hand
- UI shows notification: "Received 1 tile from opponent's blind pass"
- Hand now contains 12 tiles (passed 2, received 1)
- UI automatically transitions to Voting phase

### Step 7: Server balances tile count

- WebSocket receives `TileCountAdjustment` event:
  - `player: "South"`
  - `tiles: [balanceTile]`
- UI adds 1 balancing tile to hand (draws from wall)
- Hand returns to 13 tiles
- UI shows subtle notification: "Tile count adjusted"
- Charleston advances to Voting stage

## Expected Outcome (Assert)

- ✅ User successfully executed blind pass with 2 tiles
- ✅ User received 1 tile from opponent (asymmetric exchange)
- ✅ Server balanced hand back to 13 tiles
- ✅ Charleston advances to Voting stage
- ✅ WebSocket command payload includes `blind: true` flag
- ✅ UI correctly handled variable tile counts (2 sent, 1 received, 1 balanced)
- ✅ No Jokers were passed (client-side validation)

## Error Cases

### Attempting to blind pass Jokers

- **When**: User selects a Joker during blind pass
- **Expected**: Tile shows error border, tooltip "Jokers cannot be passed", cannot be selected
- **Assert**: Joker tiles have `disabled` attribute during blind pass

### Attempting to blind pass on wrong stage

- **When**: User is on FirstRight or FirstAcross (not FirstLeft)
- **Expected**: "Blind Pass" button is not shown (only available on FirstLeft/SecondRight)
- **Assert**: Blind pass UI only renders when `stage === 'FirstLeft' || stage === 'SecondRight'`

### All players blind pass with different counts

- **When**: All 4 players blind pass with varying tile counts (2, 1, 2, 1)
- **Expected**: Server issues multiple `TileCountAdjustment` events to balance all hands to 13
- **Assert**: Final state has all players with exactly 13 tiles before Voting

### Timer expiry during blind pass selection

- **When**: User selects 1 tile but doesn't confirm within time limit
- **Expected**: Server auto-confirms blind pass with the 1 selected tile
- **Assert**: Client receives `TilesPassed` event with `tile_count: 1, blind: true`

### Changing mind from blind pass back to standard

- **When**: User clicks "Blind Pass" but then wants standard pass instead
- **Expected**: UI shows "Cancel" button to return to standard pass selection
- **Assert**: Clicking "Cancel" returns to standard 3-tile selection UI

## Cross-References

### Related Scenarios

- [charleston-standard.md](charleston-standard.md) - Standard pass flow
- [charleston-voting.md](charleston-voting.md) - What happens after blind pass
- [charleston-iou.md](charleston-iou.md) - Extreme case: all players blind pass

### Related Components

- [BlindPassPanel](../../component-specs/charleston/BlindPassPanel.md)
- [TileSelectionPanel](../../component-specs/charleston/TileSelectionPanel.md)
- [CharlestonTracker](../../component-specs/charleston/CharlestonTracker.md)
- [PassTilesButton](../../component-specs/charleston/PassTilesButton.md)

### Backend References

- Command: `mahjong_core::command::PassTiles { blind: bool }`
- Event: `mahjong_core::event::TilesPassed`, `TilesReceived`, `TileCountAdjustment`
- State: `GameState::Charleston(CharlestonStage::FirstLeft)`

### Accessibility Notes

- Blind pass mode announced: "Blind pass mode activated. Select 1 or 2 tiles."
- Selection count announced: "1 of 2 tiles selected. Minimum met. You may confirm."
- Received tile count announced: "Received 1 tile from opponent. Hand balanced to 13 tiles."
- Toggle between standard/blind pass must be keyboard accessible (Tab + Enter)
