# Test Scenario: Charleston Courtesy Pass

**User Story**: US-007 - Charleston Courtesy Pass Negotiation
**Component Specs**: CourtesyPassPanel.md, TileSelectionPanel.md, CharlestonTracker.md
**Fixtures**: `charleston-courtesy.json`, `courtesy-pass-sequence.json`
**Manual Test**: Manual Testing Checklist #6

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-courtesy.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: East (dealer)
- **Player hand**: 13 tiles (after Second Charleston completed)
- **Charleston stage**: CourtesyAcross
- **Time remaining**: 30 seconds
- **Special context**: Second Charleston completed, now in courtesy pass phase
- **Opponent**: User passes with player directly across (West)

## Steps (Act)

### Step 1: Verify Courtesy Pass UI is displayed

- User sees "Charleston: Courtesy Pass" header
- User sees their 13 concealed tiles
- User sees instruction: "Optional: Pass 0-3 tiles with player across from you"
- User sees three button options:
  - "Skip Courtesy Pass" (skip this phase)
  - "Pass 1-3 Tiles" (participate in courtesy exchange)
- User sees opponent indicator: "Passing with: West"
- User sees countdown timer: "30s remaining"
- All buttons are enabled

### Step 2: User chooses to participate

- User clicks "Pass 1-3 Tiles" button
- UI transitions to tile selection mode
- UI shows "Select 1-3 tiles to pass across" instruction
- Counter shows "0/3 tiles selected (min: 0)"
- "Confirm Courtesy Pass" button appears (enabled even at 0 tiles)
- "Cancel" button to return to skip option

### Step 3: User selects tiles for courtesy pass

- User clicks tile at index 2 (e.g., "3 Bam (2)")
  - Tile highlights with selection border
  - Counter updates to "1/3 tiles selected"
- User clicks tile at index 7 (e.g., "South Wind (28)")
  - Second tile highlights
  - Counter updates to "2/3 tiles selected"
- User decides not to select a third tile (2 is enough)

### Step 4: User proposes courtesy pass count

- User clicks "Confirm Courtesy Pass" button
- WebSocket sends `ProposeCourtesyPass` command with:
  - `tile_count: 2`
- UI shows "Waiting for West to decide..." spinner
- Selection UI becomes disabled
- UI displays info: "West can choose 0-3 tiles"

### Step 5: Opponent declines courtesy pass

- WebSocket receives private `CourtesyPassProposed` event:
  - `player: "West"`
  - `tile_count: 0`
- WebSocket receives private `CourtesyPassMismatch` event:
  - `pair: (East, West)`
  - `proposed: (2, 0)`
  - `agreed_count: 0`
- UI shows notification: "West declined courtesy pass"
- No tiles are exchanged

### Step 6: Courtesy pass completes without exchange

- WebSocket receives `CourtesyPassComplete` event
- Hand still contains original 13 tiles
- UI shows message: "Courtesy pass not completed - opponent declined"
- Charleston ends, game transitions to Playing state

### Step 7: Game proceeds to main gameplay

- WebSocket receives `PhaseChanged` event:
  - `phase: "Playing"`
- Charleston UI unmounts
- Main game board displays
- East (dealer) draws first tile to start the game

## Expected Outcome (Assert)

- ✅ User successfully offered courtesy pass (2 tiles)
- ✅ Opponent declined courtesy pass
- ✅ User's tiles were returned (no exchange occurred)
- ✅ Hand still contains original 13 tiles
- ✅ Charleston ended and transitioned to Playing phase
- ✅ WebSocket command payload matches expected structure
- ✅ UI correctly handled the declined exchange scenario

## Error Cases

### Both players skip courtesy pass

- **When**: User clicks "Skip Courtesy Pass" immediately
- **Expected**:
  - WebSocket sends `ProposeCourtesyPass` with `tile_count: 0`
  - When opponent also proposes 0, Charleston ends immediately
  - `PhaseChanged` event to Playing
- **Assert**: Fastest path through courtesy pass (both skip)

### Attempting to pass Jokers

- **When**: User selects a Joker during courtesy pass
- **Expected**: Tile shows error border, tooltip "Jokers cannot be passed"
- **Assert**: Joker tiles have `disabled` attribute during courtesy pass

### Selecting 0 tiles (edge case)

- **When**: User clicks "Pass 1-3 Tiles" but confirms with 0 tiles selected
- **Expected**: Same as clicking "Skip Courtesy Pass" - treated as declining
- **Assert**: Server receives `ProposeCourtesyPass` with `tile_count: 0`

### Timer expiry during selection

- **When**: User selects 2 tiles but doesn't confirm within time limit
- **Expected**:
  - Server auto-confirms with selected tiles OR auto-skips (implementation choice)
  - Client receives appropriate event
  - UI shows "Auto-passed due to timeout" or "Auto-skipped"
- **Assert**: Timeout doesn't leave player in limbo state

### Mismatched tile counts (asymmetric exchange)

- **When**: User proposes 3 tiles, opponent proposes 1 tile
- **Expected**:
  - Server emits `CourtesyPassMismatch` and uses `agreed_count: 1`
  - Both players exchange 1 tile
- **Assert**: Both players end with exactly 13 tiles after exchange

## Alternate Outcome: Successful Mutual Courtesy Pass

### Steps (Alternate Path)

- **Setup**: Same as main scenario through Step 4
- **Step 5 (Alternate)**: Opponent also participates
  - WebSocket receives private `CourtesyPairReady` event:
    - `pair: (East, West)`
    - `tile_count: 2`
  - UI shows: "Courtesy pass agreed - select 2 tiles"

- **Step 6 (Alternate)**: Exchange completes successfully
  - User sends `AcceptCourtesyPass` with 2 tiles
  - WebSocket receives private `TilesReceived` event:
    - `player: "East"`
    - `tiles: [westTile1, westTile2]`
  - UI removes user's 2 passed tiles
  - UI adds opponent's 2 received tiles
  - Hand returns to 13 tiles

- **Assert**:
  - ✅ Mutual courtesy pass completed successfully
  - ✅ User ended with 13 tiles after exchange
  - ✅ Charleston completed, game transitioned to Playing

## Cross-References

### Related Scenarios

- [charleston-voting.md](charleston-voting.md) - Voting to reach Second Charleston
- [charleston-standard.md](charleston-standard.md) - Standard pass mechanics
- [charleston-blind-pass.md](charleston-blind-pass.md) - Similar asymmetric exchange

### Related Components

- [CourtesyPassPanel](../../component-specs/charleston/CourtesyPassPanel.md)
- [TileSelectionPanel](../../component-specs/charleston/TileSelectionPanel.md)
- [CharlestonTracker](../../component-specs/charleston/CharlestonTracker.md)
- [PassTilesButton](../../component-specs/charleston/PassTilesButton.md)

### Backend References

- Command: `mahjong_core::command::ProposeCourtesyPass`, `AcceptCourtesyPass`
- Event: `mahjong_core::event::CourtesyPassComplete` (public), `CourtesyPassProposed`, `CourtesyPassMismatch`, `CourtesyPairReady` (private), `TilesReceived` (private)
- State: `GameState::Charleston(CharlestonStage::CourtesyAcross)`

### Accessibility Notes

- Courtesy pass options announced: "Optional courtesy pass. Pass 0 to 3 tiles with player across, or skip this phase."
- Opponent decision announced: "West declined courtesy pass. Your tiles were returned."
- Tile count adjustments announced: "Received 3 tiles, passed 2 tiles. Hand adjusted to 13 tiles."
- Skip button has keyboard shortcut (Escape or S key)
