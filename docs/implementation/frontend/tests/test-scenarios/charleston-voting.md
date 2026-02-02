# Test Scenario: Charleston Stop Voting

**User Story**: US-005 - Charleston Voting to Stop/Continue
**Component Specs**: VotingPanel.md, CharlestonTracker.md, PlayerStatusIndicator.md
**Fixtures**: `charleston-voting.json`, `charleston-vote-sequence.json`
**Manual Test**: Manual Testing Checklist #5

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-voting.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: West
- **Player hand**: 13 tiles (after FirstLeft pass completed)
- **Charleston stage**: VotingToContinue (after First Charleston complete)
- **Time remaining**: 30 seconds (voting timer)
- **Other players**: 3 other players also in voting state

## Steps (Act)

### Step 1: Verify Voting UI is displayed

- User sees "Charleston: Vote to Continue" header
- User sees their current 13-tile hand (concealed, no selection enabled)
- User sees two prominent vote buttons:
  - "Stop Charleston" (green, recommended for most players)
  - "Continue to Second Charleston" (blue)
- User sees explanation text:
  - "First Charleston complete. Vote to stop here or continue with Second Charleston."
  - "All 4 players must vote 'Continue' to proceed."
- User sees vote status for all players:
  - East: Waiting...
  - South: Waiting...
  - West: (You)
  - North: Waiting...
- User sees countdown timer: "30s remaining"

### Step 2: User votes to stop

- User clicks "Stop Charleston" button
- Vote buttons become disabled immediately
- UI shows user's vote: "West: Voted to Stop"
- WebSocket sends `VoteCharleston` command with:
  - `vote: Stop`
- UI updates to "Waiting for other players..." spinner

### Step 3: Other players vote progressively

- WebSocket receives `PlayerVoted` event:
  - `player: "East"`
- UI updates: "East: Voted to Stop"
- WebSocket receives `PlayerVoted` event:
  - `player: "South"`
- UI updates: "South: Voted to Stop"
- UI shows progress: "3/4 players voted"

### Step 4: Final vote determines outcome (stop)

- WebSocket receives `PlayerVoted` event:
  - `player: "North"`
- UI updates: "North: Voted to Stop"
- WebSocket receives `VoteResult` event:
  - `result: "Stop"`
- UI shows result overlay: "Charleston stopped by unanimous vote"
- Charleston phase ends, game transitions to Playing state

### Step 5: Game proceeds to main gameplay

- WebSocket receives `PhaseChanged` event:
  - `phase: "Playing"`
- UI transitions to main game board
- East (dealer) draws first tile and begins turn
- Charleston UI components unmount

## Expected Outcome (Assert)

- ✅ User successfully voted to stop Charleston
- ✅ All 4 players' votes were collected
- ✅ Vote tally was unanimous (4-0 to stop)
- ✅ Charleston ended and game proceeded to Playing phase
- ✅ WebSocket command payload matches expected structure
- ✅ UI correctly reflected vote status for all players
- ✅ No Second Charleston occurred

## Error Cases

### One player votes to continue (vote fails)

- **When**: User and 2 others vote Stop, but 1 player votes Continue
- **Expected**:
  - `VoteResult` event: `result: "Stop"` (any Stop vote blocks)
  - UI shows: "Charleston stopped. Not all players agreed to continue."
- **Assert**: Even 3-1 vote stops Charleston (must be unanimous to continue)

### Timer expiry before all votes submitted

- **When**: 2 players vote, but 2 players don't vote within 30 seconds
- **Expected**:
  - Server auto-votes "Stop" for players who didn't vote
  - `PlayerVoted` events emitted as auto-votes (no vote payload)
  - UI shows: "East: Auto-voted to Stop (timeout)"
  - Charleston stops (default is to stop)
- **Assert**: Non-votes are treated as "Stop" votes

### WebSocket disconnect during voting

- **When**: Connection lost after user voted but before result received
- **Expected**:
  - Client shows "Reconnecting..." overlay
  - On reconnect, server sends current vote state
  - If voting finished while offline, client receives `VotingComplete` event on reconnect
- **Assert**: Vote is preserved on server; client doesn't re-vote

### Attempting to change vote

- **When**: User clicks "Stop Charleston" then tries to click "Continue"
- **Expected**: Continue button remains disabled; vote is final
- **Assert**: Once `VoteCharleston` command sent, UI prevents changing vote

## Alternate Outcome: Unanimous Continue

### Steps (Alternate Path)

- **Setup**: Same as main scenario
- **Step 2**: User clicks "Continue to Second Charleston" instead
  - `VoteCharleston` command with `vote: Continue`
- **Step 3-4**: All other players also vote Continue
- **Result**:
  - WebSocket receives `VoteResult` event:
    - `result: "Continue"`
  - UI shows: "All players voted to continue!"
  - Charleston advances to SecondLeft stage
- **Assert**:
  - ✅ Second Charleston begins with SecondLeft pass
  - ✅ UI shows "Charleston: Second Left" header
  - ✅ User can select 3 tiles for leftward pass

## Cross-References

### Related Scenarios

- [charleston-standard.md](charleston-standard.md) - First Charleston passes
- [charleston-blind-pass.md](charleston-blind-pass.md) - Blind pass before voting
- [charleston-courtesy-pass.md](charleston-courtesy-pass.md) - What happens after Second Charleston

### Related Components

- [VotingPanel](../../component-specs/charleston/VotingPanel.md)
- [CharlestonTracker](../../component-specs/charleston/CharlestonTracker.md)
- [PlayerStatusIndicator](../../component-specs/game/PlayerStatusIndicator.md)
- [VoteButton](../../component-specs/charleston/VoteButton.md)

### Backend References

- Command: `mahjong_core::command::VoteCharleston { continue: bool }`
- Event: `mahjong_core::event::PlayerVoted`, `VoteResult`, `PhaseChanged`
- State: `GameState::Charleston(CharlestonStage::VotingToContinue)`

### Accessibility Notes

- Voting options announced: "Vote to stop Charleston or continue to Second Charleston. All players must agree to continue."
- Vote buttons have clear focus indicators and keyboard shortcuts (S for Stop, C for Continue)
- Other players' votes announced as they come in: "East voted to stop. 1 of 4 votes received."
- Final result announced: "Voting complete. Charleston stopped by vote. Proceeding to main game."
