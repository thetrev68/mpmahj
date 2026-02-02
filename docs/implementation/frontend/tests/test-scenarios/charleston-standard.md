# Test Scenario: Charleston Standard Pass (First Right)

**User Story**: US-002 - Charleston First Right
**Component Specs**: TileSelectionPanel.md, CharlestonTracker.md, ConcealedHand.md
**Fixtures**: `charleston-first-right.json`, `charleston-pass-sequence.json`
**Manual Test**: Manual Testing Checklist #2

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-first-right.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: East (dealer position)
- **Player hand**: 13 tiles loaded from fixture
- **Charleston stage**: FirstRight
- **Time remaining**: 45 seconds (default timer)

## Steps (Act)

### Step 1: Verify Charleston UI is displayed

- User sees "Charleston: First Right" header
- User sees their 13 concealed tiles
- User sees "Pass Tiles" button (disabled initially)
- User sees "0/3 tiles selected" counter
- User sees countdown timer

### Step 2: User selects 3 tiles

- User clicks on tile at index 0 (e.g., "2 Bam")
  - Tile highlights with selection border
  - Counter updates to "1/3 tiles selected"
- User clicks on tile at index 5 (e.g., "7 Crak")
  - Second tile highlights
  - Counter updates to "2/3 tiles selected"
- User clicks on tile at index 10 (e.g., "Flower")
  - Third tile highlights
  - Counter updates to "3/3 tiles selected"
  - "Pass Tiles" button becomes enabled

### Step 3: User deselects and reselects (error case)

- User clicks selected tile at index 5 again
  - Tile unhighlights
  - Counter updates to "2/3 tiles selected"
  - "Pass Tiles" button becomes disabled
- User clicks tile at index 7 (e.g., "White Dragon")
  - Counter updates to "3/3 tiles selected"
  - "Pass Tiles" button re-enabled

### Step 4: User submits pass

- User clicks "Pass Tiles" button
- WebSocket sends `PassTiles` command with:
  - `stage: "FirstRight"`
  - `tiles: [tileAt0, tileAt5, tileAt7]`
- UI shows "Waiting for other players..." spinner
- Selection UI becomes disabled

### Step 5: Server responds with events

- WebSocket receives private `TilesPassed` event:
  - `player: "East"`
  - `tiles: [tileAt0, tileAt5, tileAt7]`
- UI removes the 3 passed tiles from user's hand
- UI shows "Waiting to receive tiles..." message

### Step 6: User receives passed tiles

- WebSocket receives private `TilesReceived` event:
  - `player: "East"`
  - `tiles: [newTile1, newTile2, newTile3]`
- UI adds 3 new tiles to user's hand
- Tiles sort automatically based on settings
- WebSocket receives `CharlestonPhaseChanged`:
  - `stage: "FirstAcross"`
- UI shows "Ready for next stage" or proceeds to FirstAcross

## Expected Outcome (Assert)

- ✅ User successfully passed 3 tiles to the right
- ✅ User received 3 tiles from the left
- ✅ Hand still contains 13 tiles total
- ✅ Charleston advances to next stage (FirstAcross)
- ✅ WebSocket command payload matches expected structure
- ✅ UI state resets for next pass (selection cleared)
- ✅ No Jokers were passed (client-side validation prevented it)

## Error Cases

### Attempting to pass Jokers

- **When**: User selects a Joker tile
- **Expected**: Tile shows error border, tooltip "Jokers cannot be passed", cannot be selected
- **Assert**: Joker tiles have `disabled` attribute in Charleston phases

### Timer expiry

- **When**: User does not select tiles within 45 seconds
- **Expected**: Server auto-selects 3 random non-Joker tiles and passes them
- **Assert**: Client receives `TilesPassed` event without user action, shows notification "Auto-passed due to timeout"

### WebSocket disconnect during selection

- **When**: Connection lost while user has 2/3 tiles selected
- **Expected**: Client shows "Reconnecting..." overlay, preserves selection state
- **Assert**: On reconnect, client re-syncs state and either restores selection or receives server's auto-pass

### Attempting to pass wrong number of tiles

- **When**: User tries to submit with fewer than 3 tiles (shouldn't happen due to UI validation)
- **Expected**: "Pass Tiles" button remains disabled
- **Assert**: Button's `disabled` state correctly reflects selection count !== 3

## Cross-References

### Related Scenarios

- `charleston-blind-pass.md` - Blind passing on FirstLeft
- `charleston-voting.md` - Voting to stop after FirstLeft
- `charleston-courtesy-pass.md` - Optional courtesy pass

### Related Components

- [TileSelectionPanel](../../component-specs/charleston/TileSelectionPanel.md)
- [CharlestonTracker](../../component-specs/charleston/CharlestonTracker.md)
- [ConcealedHand](../../component-specs/game/ConcealedHand.md)
- [PassTilesButton](../../component-specs/charleston/PassTilesButton.md)

### Backend References

- Command: `mahjong_core::command::PassTiles`
- Event: `mahjong_core::event::TilesPassed`, `TilesReceived`
- State: `GameState::Charleston(CharlestonStage::FirstRight)`

### Accessibility Notes

- Tile selection must be keyboard navigable (arrow keys + Space)
- Selected tiles announced by screen reader: "2 Bamboo selected, 1 of 3"
- Timer countdown announced at 10s, 5s, 0s
- "Pass Tiles" button has clear focus indicator
