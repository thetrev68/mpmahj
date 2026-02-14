# US-005: Charleston Voting (Stop/Continue)

## Story

**As a** player in any seat
**I want** to vote whether to stop Charleston after the first three passes or continue to a second Charleston
**So that** I can influence the game flow based on my current hand

## Acceptance Criteria

### AC-1: Voting Phase Entry

**Given** the First Left pass has completed and all players received tiles
**When** the server emits `CharlestonPhaseChanged { stage: VotingToContinue }`
**Then** the Charleston tracker displays "Vote: Stop or Continue?"
**And** a timer starts (default: 30 seconds for voting)
**And** two prominent buttons appear: "Stop Charleston" and "Continue Charleston"
**And** a message displays: "Vote now - any Stop vote ends Charleston"
**And** my hand is visible but non-interactive

### AC-2: Vote Submission (Stop)

**Given** I am in the `Charleston(VotingToContinue)` stage
**When** I click the "Stop Charleston" button
**Then** a `VoteCharleston { player: me, vote: Stop }` command is sent
**And** the button shows a loading state (spinner, disabled)
**And** both buttons become disabled
**And** a message appears: "You voted to STOP. Waiting for other players..."
**And** a checkmark appears next to my name in the player list

### AC-3: Vote Submission (Continue)

**Given** I am in the `Charleston(VotingToContinue)` stage
**When** I click the "Continue Charleston" button
**Then** a `VoteCharleston { player: me, vote: Continue }` command is sent
**And** the button shows a loading state (spinner, disabled)
**And** both buttons become disabled
**And** a message appears: "You voted to CONTINUE. Waiting for other players..."
**And** a checkmark appears next to my name in the player list

### AC-4: Vote Progress Tracking

**Given** I have submitted my vote
**When** other players submit their votes
**Then** I see `PlayerVoted { player }` events for each player
**And** a progress indicator shows "3/4 players voted"
**And** the message updates: "Waiting for [PlayerName]..."
**And** I cannot see HOW other players voted (just that they voted)

### AC-5: Vote Result (Stop - Any Stop Vote)

**Given** all 4 players have voted
**When** at least ONE player voted "Stop"
**Then** the server emits `VoteResult { result: Stop }`
**And** the vote UI dismisses
**And** a message appears: "Charleston STOPPED by vote. Main game starting..."
**And** the server emits `CharlestonComplete`
**And** the phase advances to `Playing`

### AC-6: Vote Result (Continue - Unanimous)

**Given** all 4 players have voted
**When** ALL 4 players voted "Continue"
**Then** the server emits `VoteResult { result: Continue }`
**And** the vote UI dismisses
**And** a message appears: "Charleston CONTINUES - Second Charleston starting..."
**And** the server emits `CharlestonPhaseChanged { stage: SecondLeft }`
**And** the timer resets for the next pass (60 seconds)

### AC-7: Early Vote Resolution (Immediate Stop)

**Given** 1 or more players have voted "Stop"
**When** enough votes are in to guarantee a Stop outcome (even if not all players voted)
**Then** the server may emit `VoteResult { result: Stop }` early
**And** remaining players' votes are cancelled
**And** the Charleston ends immediately
**Note:** This is an optimization - backend may wait for all votes regardless.

### AC-8: Timer Expiry (Auto-Vote)

**Given** the voting timer reaches 0 and I haven't voted
**When** timeout occurs
**Then** an automatic "Stop" vote is cast on my behalf
**And** a message appears: "Time expired - auto-voted to STOP"
**And** the `VoteCharleston { vote: Stop }` command is sent

### AC-9: Bot Auto-Vote

**Given** the game is in `Charleston(VotingToContinue)` stage
**And** one or more players are bots
**When** the voting phase begins
**Then** bots automatically vote after a delay (0.5-1.5 seconds)
**And** bot vote strategy:

- **Basic**: Always Stop (75% chance) or Continue (25%)
- **Easy**: Random (50/50)
- **Medium**: Based on hand analysis (if good hand, Stop; if bad, Continue)
- **Hard**: Strategic analysis (evaluate deficiency, pattern viability)
  **And** human players see "PlayerName (Bot) has voted" message

### AC-10: Vote Display After Result

**Given** the vote result has been announced
**When** the result UI appears
**Then** the vote breakdown is shown: "3 Stop, 1 Continue - Charleston STOPPED"
**And** individual votes are revealed: "East: Stop, South: Continue, West: Stop, North: Stop"
**And** the UI displays for 3 seconds before dismissing

## Technical Details

### Commands (Frontend → Backend)

```typescript
// Vote to stop
{
  VoteCharleston: {
    player: Seat,
    vote: "Stop"
  }
}

// Vote to continue
{
  VoteCharleston: {
    player: Seat,
    vote: "Continue"
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "VotingToContinue" }
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonTimerStarted: {
      stage: "VotingToContinue",
      duration: 30,  // Shorter timer for voting
      started_at_ms: 1706634180000,
      timer_mode: "Standard"
    }
  }
}

{
  kind: 'Public',
  event: {
    PlayerVoted: {
      player: Seat  // Who voted (not how they voted)
    }
  }
}

{
  kind: 'Public',
  event: {
    VoteResult: {
      result: "Stop"  // or "Continue"
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonComplete: {}  // Charleston ends, main game starts
  }
}

// OR

{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "SecondLeft" }  // Second Charleston begins
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `VoteCharleston` command
  - `crates/mahjong_core/src/flow/charleston/mod.rs` - Voting logic
  - `crates/mahjong_core/src/flow/charleston/stage.rs` - VotingToContinue stage
  - `crates/mahjong_core/src/event/public_events.rs` - `PlayerVoted`, `VoteResult`, `CharlestonComplete`
- **Game Design Doc**:
  - Section 2.2.6 (Voting to Continue/Stop)
  - Section 2.2.7 (Second Charleston Initiation)

## Components Involved

- **`<CharlestonTracker>`** - Displays "VotingToContinue" stage
- **`<VotingPanel>`** - New component: Stop/Continue buttons and vote progress
- **`<VoteResultOverlay>`** - New component: Displays vote breakdown and result
- **`<CharlestonTimer>`** - Countdown timer (30s for voting)
- **`<PlayerStatusIndicator>`** - Shows checkmarks for players who voted

**Component Specs:**

- `component-specs/presentational/CharlestonTracker.md`
- `component-specs/presentational/VotingPanel.md` (NEW)
- `component-specs/presentational/VoteResultOverlay.md` (NEW)
- `component-specs/presentational/CharlestonTimer.md`

## Test Scenarios

- **`tests/test-scenarios/charleston-voting-unanimous-continue.md`** - All vote Continue
- **`tests/test-scenarios/charleston-voting-any-stop.md`** - At least one Stop vote
- **`tests/test-scenarios/charleston-voting-timer-expiry.md`** - Auto-vote on timeout
- **`tests/test-scenarios/charleston-voting-bot-behavior.md`** - Bot voting strategies

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/charleston-voting.json` - Voting state
- `tests/fixtures/events/charleston-voting-stop.json` - Stop vote event flow
- `tests/fixtures/events/charleston-voting-continue.json` - Continue vote event flow

**Sample Vote Event Sequence (Stop):**

```json
{
  "scenario": "Vote to Stop (3 Stop, 1 Continue)",
  "events": [
    {
      "kind": "Public",
      "event": { "CharlestonPhaseChanged": { "stage": "VotingToContinue" } }
    },
    {
      "kind": "Public",
      "event": {
        "CharlestonTimerStarted": {
          "stage": "VotingToContinue",
          "duration": 30,
          "started_at_ms": 1706634180000,
          "timer_mode": "Standard"
        }
      }
    },
    {
      "kind": "Public",
      "event": { "PlayerVoted": { "player": "East" } }
    },
    {
      "kind": "Public",
      "event": { "PlayerVoted": { "player": "South" } }
    },
    {
      "kind": "Public",
      "event": { "PlayerVoted": { "player": "West" } }
    },
    {
      "kind": "Public",
      "event": { "PlayerVoted": { "player": "North" } }
    },
    {
      "kind": "Public",
      "event": { "VoteResult": { "result": "Stop" } }
    },
    {
      "kind": "Public",
      "event": { "CharlestonComplete": {} }
    },
    {
      "kind": "Public",
      "event": { "PhaseChanged": { "phase": "Playing" } }
    }
  ]
}
```

## Edge Cases

### EC-1: Timer Expiry (Auto-Stop)

**Given** the voting timer reaches 0 and I haven't voted
**When** timeout occurs
**Then** an automatic "Stop" vote is cast for me
**And** I see: "Time expired - auto-voted to STOP"

### EC-2: Any Stop Vote Ends Charleston

**Given** 3 players voted "Continue" and 1 voted "Stop"
**When** all votes are in
**Then** the result is "Stop" (not majority, but ANY stop)
**And** the Charleston ends immediately

### EC-3: Unanimous Continue Required

**Given** all 4 players must vote "Continue"
**When** even 1 player votes "Stop"
**Then** the result is "Stop"
**And** the Charleston ends

### EC-4: Early Vote Resolution (Optimization)

**Given** 1 player has voted "Stop" and 2 others have voted "Continue"
**When** the server detects that a Stop outcome is guaranteed
**Then** the server may resolve the vote immediately without waiting for the 4th player
**And** the 4th player's vote UI dismisses
**Note:** This is an optional optimization; backend may always wait for all 4 votes.

### EC-5: Disconnection During Voting

**Given** I disconnect before voting
**When** I reconnect and the voting is still active
**Then** the vote UI re-appears
**And** I can still vote within the remaining time
**And** the timer continues from server time

**Given** I disconnect after voting
**When** I reconnect
**Then** I see my vote status: "You voted to STOP"
**And** I cannot change my vote

### EC-6: Double-Submit Prevention

**Given** I click "Stop Charleston"
**When** I rapidly click again before server responds
**Then** only ONE `VoteCharleston` command is sent
**And** the button is disabled after first click

### EC-7: Network Error on Vote

**Given** I submit a vote but network fails
**When** no `PlayerVoted` acknowledgment is received within 5 seconds
**Then** an error toast appears: "Failed to submit vote. Retrying..."
**And** the command is automatically retried (max 3 attempts)
**And** if all retries fail, show "Connection lost" with manual retry button

## Related User Stories

- **US-004**: Charleston First Left (Blind Pass) - Previous stage
- **US-006**: Charleston Second Charleston (Optional) - Next stage if Continue
- **US-009**: Drawing a Tile - Next stage if Stop (main game starts)
- **US-036**: Timer Configuration - Adjust default 30s voting timer

## Accessibility Considerations

### Keyboard Navigation

- **Tab**: Navigate between Stop and Continue buttons
- **Space/Enter**: Submit vote for focused button
- **S Key**: Shortcut for "Stop Charleston"
- **C Key**: Shortcut for "Continue Charleston"

### Screen Reader

- **Voting Phase**: "Charleston voting phase. Vote to stop or continue. Any stop vote will end Charleston. All continue votes will start Second Charleston."
- **Vote Submitted**: "You voted to STOP. Waiting for 3 other players to vote."
- **Vote Progress**: "3 of 4 players have voted. Waiting for PlayerName."
- **Vote Result**: "Vote result: STOP. Charleston ended. 3 players voted Stop, 1 voted Continue."

### Visual

- **High Contrast**: Vote buttons have clear, high-contrast colors (Stop: red, Continue: green)
- **Color-Blind**: Use icons in addition to color (Stop: ✕, Continue: ✓)
- **Motion**: Respect `prefers-reduced-motion` for vote result overlay animations
- **Large Buttons**: Vote buttons are large and prominent (min 120px height)

## Priority

**CRITICAL** - Required for Charleston flow decision point

## Story Points / Complexity

**5** - Medium-High complexity

- Two-choice voting UI
- Vote progress tracking (4 players)
- Vote result calculation (any Stop vs all Continue)
- Timer synchronization
- Bot voting strategies
- Vote reveal UI
- Early resolution optimization
- Phase transition logic (Stop → Playing, Continue → SecondLeft)

## Definition of Done

- [ ] Charleston tracker shows "VotingToContinue" stage
- [ ] Timer starts at 30 seconds and counts down
- [ ] Two prominent buttons: "Stop Charleston" and "Continue Charleston"
- [ ] User can click either button to vote
- [ ] `VoteCharleston` command sent with correct vote
- [ ] Buttons disabled after vote submission
- [ ] Vote progress indicator shows how many players have voted (not how)
- [ ] `PlayerVoted` events update progress indicator
- [ ] `VoteResult` event displays result overlay
- [ ] Vote breakdown shown: "X Stop, Y Continue"
- [ ] Individual votes revealed after result
- [ ] Charleston ends if any Stop vote (`CharlestonComplete` → `Playing`)
- [ ] Second Charleston starts if all Continue (`CharlestonPhaseChanged { SecondLeft }`)
- [ ] Timer expiry triggers auto-vote to Stop
- [ ] Bot auto-vote behavior works with strategy-based decisions
- [ ] Component tests pass (VotingPanel, VoteResultOverlay)
- [ ] Integration tests pass (unanimous continue, any stop flows)
- [ ] E2E test passes (full voting sequence with all outcomes)
- [ ] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [ ] Visual regression tests pass (vote buttons, result overlay)
- [ ] Timer expiry behavior tested (auto-vote)
- [ ] Network error handling tested (retry logic)
- [ ] Early resolution tested (if implemented)
- [ ] Manually tested against `user-testing-plan.md` (Part 3, Charleston voting)
- [ ] Code reviewed and approved
- [ ] Performance tested (no lag during vote resolution)
- [ ] No console errors or warnings

## Notes for Implementers

### Vote Result Calculation

Per NMJL rules:

- **Any Stop vote** → Charleston ends
- **All Continue votes** → Second Charleston begins

```typescript
function calculateVoteResult(votes: Record<Seat, CharlestonVote>): CharlestonVote {
  const voteArray = Object.values(votes);
  const hasStopVote = voteArray.some((vote) => vote === 'Stop');
  return hasStopVote ? 'Stop' : 'Continue';
}
```

### Voting UI Component

```typescript
<VotingPanel
  onVote={(vote: 'Stop' | 'Continue') => {
    sendCommand({ VoteCharleston: { player: mySeat, vote } });
  }}
  hasVoted={hasVoted}
  voteCount={voteCount}
  totalPlayers={4}
  timeRemaining={timeRemaining}
/>
```

### Vote Result Overlay

```typescript
<VoteResultOverlay
  result={voteResult}
  votes={{
    [Seat.East]: 'Stop',
    [Seat.South]: 'Continue',
    [Seat.West]: 'Stop',
    [Seat.North]: 'Stop'
  }}
  onDismiss={() => {
    // Auto-dismiss after 3 seconds
    setShowResultOverlay(false);
  }}
/>
```

Display:

- **Title**: "Vote Result: STOP" (or "CONTINUE")
- **Breakdown**: "3 Stop, 1 Continue"
- **Individual Votes**: "East: Stop, South: Continue, West: Stop, North: Stop"
- **Outcome**: "Charleston ended. Main game starting..." (or "Second Charleston starting...")
- **Auto-dismiss**: 3 seconds

### Bot Voting Strategy

```typescript
function getBotVote(hand: Tile[], difficulty: BotDifficulty): CharlestonVote {
  switch (difficulty) {
    case 'Basic':
      return Math.random() < 0.75 ? 'Stop' : 'Continue'; // 75% Stop
    case 'Easy':
      return Math.random() < 0.5 ? 'Stop' : 'Continue'; // 50/50
    case 'Medium':
      // If hand is good (low deficiency), Stop; else Continue
      const deficiency = calculateHandDeficiency(hand);
      return deficiency < 5 ? 'Stop' : 'Continue';
    case 'Hard':
      // Strategic analysis: evaluate expected value of stopping vs continuing
      return evaluateStopVsContinue(hand);
  }
}
```

### Timer Synchronization

Voting timer is shorter (30s vs 60s for passes):

```typescript
const votingTimerDuration = 30; // seconds
const timeRemaining = useMemo(() => {
  if (!timerStart) return 0;
  const serverTime = Date.now(); // Adjust for server time offset
  const elapsed = (serverTime - timerStart) / 1000;
  return Math.max(0, votingTimerDuration - elapsed);
}, [timerStart]);
```

### Event Sequencing

Voting sequence:

1. `CharlestonPhaseChanged { stage: VotingToContinue }`
2. `CharlestonTimerStarted { stage: VotingToContinue, duration: 30, ... }`
3. User clicks vote button
4. `VoteCharleston { player, vote }`
5. `PlayerVoted { player }` (public, for each player)
6. `VoteResult { result }` (public)
7. **If Stop**:
   - `CharlestonComplete`
   - `PhaseChanged { phase: Playing }`
8. **If Continue**:
   - `CharlestonPhaseChanged { stage: SecondLeft }`
   - `CharlestonTimerStarted { stage: SecondLeft, ... }`

### Zustand Store Updates

```typescript
case 'PlayerVoted':
  state.playerStatuses[event.player].hasVoted = true;
  state.voteCount += 1;
  break;

case 'VoteResult':
  state.voteResult = event.result;
  // Optionally store individual votes (if backend provides)
  break;

case 'CharlestonComplete':
  state.charlestonComplete = true;
  state.phase = 'Playing'; // Will be confirmed by PhaseChanged event
  break;
```

### Early Vote Resolution (Optional)

If backend supports early resolution:

```typescript
// After 1 Stop vote and 2 Continue votes are in, backend can resolve immediately
if (stopVotes >= 1) {
  // Result is guaranteed to be Stop, resolve now
  emit VoteResult { result: Stop }
  // Cancel remaining votes
}
```

Frontend should handle this gracefully by dismissing vote UI for all players.

### Instant Animation Mode

When "Instant Animations" setting is enabled:

- Vote result overlay appears/dismisses instantly (no fade)
- No staggered reveal of individual votes
- Sound effects still play

```text

```

```text

```
