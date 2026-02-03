# Test Scenario: Charleston First Across Pass

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-003 - Charleston First Across
**Component Specs**: TileSelectionPanel.md, CharlestonTracker.md, ConcealedHand.md
**Fixtures**: `charleston-first-across.json`, `charleston-pass-sequence.json`
**Manual Test**: Manual Testing Checklist #3

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-first-across.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: East (dealer position)
- **Player hand**: 13 tiles loaded from fixture (after First Right pass completed)
- **Charleston stage**: FirstAcross
- **Time remaining**: 45 seconds (default timer)
- **Previous passes**: First Right completed (user passed 3 tiles right, received 3 from left)

## Steps (Act)

### Step 1: Verify Charleston UI is displayed for First Across

- User sees "Charleston: First Across" header
- User sees their 13 concealed tiles (updated from First Right pass)
- User sees "Pass Tiles" button (disabled initially)
- User sees "0/3 tiles selected" counter
- User sees countdown timer
- Charleston tracker shows progress: [✓ First Right] → [→ First Across] → [First Left] → [Second Charleston]

### Step 2: User selects 3 tiles for across pass

- User clicks on tile at index 2 (e.g., "4 Dot (21)")
  - Tile highlights with selection border
  - Counter updates to "1/3 tiles selected"
- User clicks on tile at index 8 (e.g., "North Wind (28)")
  - Second tile highlights
  - Counter updates to "2/3 tiles selected"
- User clicks on tile at index 11 (e.g., "8 Crak (16)")
  - Third tile highlights
  - Counter updates to "3/3 tiles selected"
  - "Pass Tiles" button becomes enabled

### Step 3: User submits across pass

- User clicks "Pass Tiles" button
- WebSocket sends `PassTiles` command with:
  - `stage: "FirstAcross"`
  - `tiles: [tileAt2, tileAt8, tileAt11]`
- UI shows "Waiting for other players..." spinner
- Selection UI becomes disabled

### Step 4: Server responds with events

- WebSocket receives private `TilesPassed` event:
  - `player: "East"`
  - `tiles: [tileAt2, tileAt8, tileAt11]`
- UI removes the 3 passed tiles from user's hand
- UI shows "Waiting to receive tiles..." message

### Step 5: User receives passed tiles from across

- WebSocket receives private `TilesReceived` event:
  - `player: "East"`
  - `tiles: [newTile1, newTile2, newTile3]` (from West, the player across)
- UI adds 3 new tiles to user's hand
- Tiles sort automatically based on settings
- WebSocket receives `CharlestonPhaseChanged`:
  - `stage: "FirstLeft"`
- UI shows "Ready for next stage" or proceeds to FirstLeft
- Charleston tracker updates: [✓ First Right] → [✓ First Across] → [→ First Left] → [Second Charleston]

### Step 6: Verify hand state

- User's hand still contains 13 tiles total
- Passed tiles removed, new tiles added
- No Jokers were passed (client-side validation prevented it)
- Hand is ready for First Left pass

## Expected Outcome (Assert)

- ✅ User successfully passed 3 tiles across (to West)
- ✅ User received 3 tiles from across (from West)
- ✅ Hand still contains 13 tiles total
- ✅ Charleston advances to next stage (First Left)
- ✅ WebSocket command payload matches expected structure
- ✅ UI state resets for next pass (selection cleared)
- ✅ Charleston tracker correctly shows progress

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

### Passing to wrong player (client-side validation)

- **When**: User somehow sends pass to wrong direction (shouldn't happen)
- **Expected**: Server validates stage and rejects invalid direction
- **Assert**: Client receives `CommandRejected` event with `reason: "Invalid pass direction for current stage"`

## Cross-References

### Related Scenarios

- `charleston-standard.md` - First Right pass (preceding stage)
- `charleston-blind-pass.md` - Blind passing on First Left (next stage)
- `charleston-voting.md` - Voting to stop after First Left
- `charleston-courtesy-pass.md` - Optional courtesy pass after Charleston

### Related Components

- [TileSelectionPanel](../../component-specs/charleston/TileSelectionPanel.md)
- [CharlestonTracker](../../component-specs/charleston/CharlestonTracker.md)
- [ConcealedHand](../../component-specs/game/ConcealedHand.md)
- [PassTilesButton](../../component-specs/charleston/PassTilesButton.md)

### Backend References

- Command: `mahjong_core::command::PassTiles`
- Events: `mahjong_core::event::TilesPassed`, `TilesReceived`, `CharlestonPhaseChanged`
- State: `GameState::Charleston(CharlestonStage::FirstAcross)`
- Rules: NMJL rulebook section on Charleston passes

### Accessibility Notes

- Stage announcement: "Charleston First Across pass, pass 3 tiles to West"
- Tile selection announced: "4 Dot (21) selected, 1 of 3"
- Counter announced: "2 of 3 tiles selected"
- Pass confirmation announced: "Passed 3 tiles to West"
- Receive announcement: "Received 3 tiles from West"
- Stage transition announced: "First Across complete, proceeding to First Left"
- Timer countdown announced at 10s, 5s, 0s
