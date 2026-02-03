# Test Scenario: Charleston Second Charleston (Optional)

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-006 - Charleston Second Charleston (Optional)
**Component Specs**: CharlestonTracker.md, TileSelectionPanel.md, VotingDialog.md
**Fixtures**: `charleston-second-charleston.json`, `charleston-voting-sequence.json`
**Manual Test**: Manual Testing Checklist #6

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-second-charleston.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: East (dealer position)
- **Player hand**: 13 tiles loaded from fixture (after First Left pass completed)
- **Charleston stage**: Voting (after First Left, before Second Charleston)
- **Time remaining**: 30 seconds (voting timer)
- **Previous passes**: First Right, First Across, First Left all completed

## Steps (Act)

### Step 1: Verify voting UI is displayed

- User sees "Charleston Voting" header
- User sees their 13 concealed tiles (updated from First Left pass)
- User sees voting dialog with two options:
  - "Continue Charleston" (proceed to Second Charleston)
  - "Stop Charleston" (end Charleston, proceed to main gameplay)
- User sees countdown timer (30 seconds)
- Charleston tracker shows progress: [✓ First Right] → [✓ First Across] → [✓ First Left] → [→ Voting] → [Second Charleston]

### Step 2: User evaluates hand and decides

- User scans hand to assess if Second Charleston would be beneficial
- UI may show hint: "Your hand has 3 matching tiles - Second Charleston could help"
- User decides to vote "Continue Charleston"

### Step 3: User votes to continue

- User clicks "Continue Charleston" button
- WebSocket sends `CharlestonVote` command with:
  - `vote: "Continue"`
- UI shows "Vote submitted: Continue" with spinner
- Voting buttons become disabled
- User sees "Waiting for other players..." message

### Step 4: Other players vote

- Simulated: South votes "Continue"
- Simulated: West votes "Stop"
- Simulated: North votes "Continue"
- Server tallies votes: 3 Continue, 1 Stop

### Step 5: Server resolves voting

- WebSocket receives `CharlestonVoteResolved` event:
  - `result: "Continue"`
  - `votes: { East: "Continue", South: "Continue", West: "Stop", North: "Continue" }`
- UI shows "Second Charleston will proceed!" notification
- Voting dialog closes

### Step 6: Second Charleston begins (First Right of Second Charleston)

- WebSocket receives `CharlestonPhaseChanged` event:
  - `stage: "SecondRight"`
- UI updates:
  - Charleston tracker: [✓ First Right] → [✓ First Across] → [✓ First Left] → [✓ Voting] → [→ Second Right]
  - "Pass Tiles" button appears (disabled until 3 tiles selected)
  - Tile selection UI becomes active
- Game log shows: "Second Charleston started - First Right pass"

### Step 7: User selects 3 tiles for Second Right pass

- User clicks on tile at index 1 (e.g., "2 Bam (1)")
  - Tile highlights with selection border
  - Counter updates to "1/3 tiles selected"
- User clicks on tile at index 6 (e.g., "6 Crak (15)")
  - Second tile highlights
  - Counter updates to "2/3 tiles selected"
- User clicks on tile at index 9 (e.g., "White Dragon (33)")
  - Third tile highlights
  - Counter updates to "3/3 tiles selected"
  - "Pass Tiles" button becomes enabled

### Step 8: User submits Second Right pass

- User clicks "Pass Tiles" button
- WebSocket sends `PassTiles` command with:
  - `stage: "SecondRight"`
  - `tiles: [tileAt1, tileAt6, tileAt9]`
- UI shows "Waiting for other players..." spinner
- Selection UI becomes disabled

### Step 9: Server responds with events

- WebSocket receives private `TilesPassed` event:
  - `player: "East"`
  - `tiles: [tileAt1, tileAt6, tileAt9]`
- UI removes the 3 passed tiles from user's hand
- UI shows "Waiting to receive tiles..." message

### Step 10: User receives passed tiles

- WebSocket receives private `TilesReceived` event:
  - `player: "East"`
  - `tiles: [newTile1, newTile2, newTile3]`
- UI adds 3 new tiles to user's hand
- Tiles sort automatically based on settings
- WebSocket receives `CharlestonPhaseChanged`:
  - `stage: "SecondAcross"`
- UI shows "Ready for next stage" or proceeds to Second Across

### Step 11: Second Charleston continues (Second Across, Second Left)

- User completes Second Across pass (similar to First Across)
- User completes Second Left pass (similar to First Left)
- After Second Left, Charleston ends and game transitions to main gameplay

### Step 12: Game transitions to main gameplay

- WebSocket receives `PhaseChanged` event:
  - `from: "Charleston"`
  - `to: "Playing"`
  - `stage: "Drawing"`
- UI updates:
  - Charleston tracker disappears or shows "Charleston Complete"
  - "Draw Tile" button appears (enabled for dealer)
  - Turn timer starts
- Game log shows: "Charleston complete. East's turn to draw."

## Expected Outcome (Assert)

- ✅ User successfully voted to continue Charleston
- ✅ Vote passed (3 Continue vs 1 Stop)
- ✅ Second Charleston proceeded with Second Right, Second Across, Second Left passes
- ✅ User successfully passed 3 tiles in each Second Charleston pass
- ✅ User received 3 tiles in each Second Charleston pass
- ✅ Hand still contains 13 tiles total after all passes
- ✅ Game transitioned to main gameplay (Playing phase)
- ✅ WebSocket command/event sequence correct

## Error Cases

### Voting to stop Charleston

- **When**: User votes "Stop Charleston" and majority agrees
- **Expected**: Charleston ends immediately, game transitions to main gameplay
- **Assert**:
  - `CharlestonVoteResolved` event with `result: "Stop"`
  - `PhaseChanged` event from `Charleston` to `Playing`
  - No Second Charleston passes occur

### Tie vote (2 Continue, 2 Stop)

- **When**: Vote results in tie
- **Expected**: Default to "Stop Charleston" (conservative rule)
- **Assert**:
  - `CharlestonVoteResolved` event with `result: "Stop"`
  - Game transitions to main gameplay

### Timer expiry during voting

- **When**: User does not vote within 30 seconds
- **Expected**: Server auto-votes "Continue" (default to continue)
- **Assert**: Client receives `CharlestonVoteResolved` event with user's vote as "Continue"

### Attempting to pass Jokers in Second Charleston

- **When**: User selects a Joker tile during Second Charleston pass
- **Expected**: Tile shows error border, tooltip "Jokers cannot be passed", cannot be selected
- **Assert**: Joker tiles have `disabled` attribute in all Charleston phases

### WebSocket disconnect during voting

- **When**: Connection lost while voting dialog is open
- **Expected**: Client shows "Reconnecting..." overlay, preserves vote state
- **Assert**: On reconnect, client re-syncs state and either restores vote or receives server's auto-vote

### Attempting to vote after timer expires

- **When**: User tries to vote after 30 seconds
- **Expected**: Voting buttons disabled, vote already submitted by server
- **Assert**: Buttons' `disabled` state reflects `votingClosed === true`

## Cross-References

### Related Scenarios

- `charleston-standard.md` - First Right pass (First Charleston)
- `charleston-first-across.md` - First Across pass (First Charleston)
- `charleston-blind-pass.md` - Blind passing on First Left
- `charleston-voting.md` - Detailed voting flow
- `charleston-courtesy-pass.md` - Optional courtesy pass after Charleston
- `drawing-discarding.md` - Main gameplay after Charleston

### Related Components

- [CharlestonTracker](../../component-specs/charleston/CharlestonTracker.md)
- [TileSelectionPanel](../../component-specs/charleston/TileSelectionPanel.md)
- [VotingDialog](../../component-specs/charleston/VotingDialog.md)
- [ConcealedHand](../../component-specs/game/ConcealedHand.md)

### Backend References

- Commands: `mahjong_core::command::CharlestonVote`, `PassTiles`
- Events: `mahjong_core::event::CharlestonVoteResolved`, `TilesPassed`, `TilesReceived`, `CharlestonPhaseChanged`, `PhaseChanged`
- State: `GameState::Charleston(CharlestonStage::Voting)`, `Charleston(CharlestonStage::SecondRight)`
- Rules: NMJL rulebook section on Second Charleston (optional pass)

### Accessibility Notes

- Voting dialog announced: "Charleston voting. Continue Charleston or Stop Charleston?"
- Vote options announced: "Continue Charleston, press C. Stop Charleston, press S."
- Vote submission announced: "Vote submitted: Continue Charleston"
- Vote result announced: "Second Charleston will proceed" or "Charleston stopped"
- Stage transition announced: "Second Charleston started, First Right pass"
- Timer countdown announced at 10s, 5s, 0s
