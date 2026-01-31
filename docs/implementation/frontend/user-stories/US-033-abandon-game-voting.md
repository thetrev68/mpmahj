# US-033: Abandon Game (Voting)

## Story

**As a** player in an active game
**I want** to propose abandoning the game with all players voting
**So that** a stuck or problematic game can be ended gracefully by mutual agreement

## Acceptance Criteria

### AC-1: Propose Abandon Button Available

**Given** I am in an active game (any phase except GameOver)
**When** the game UI is displayed
**Then** a "Propose Abandon" button is visible in the game menu
**And** the button is always enabled during active gameplay
**And** the button has an info icon for clarity

### AC-2: Reason Input Dialog Opens

**Given** I am in an active game
**When** I click the "Propose Abandon" button
**Then** a dialog opens with title: "Propose Abandoning Game"
**And** the dialog contains an optional text input: "Reason (optional)"
**And** placeholder text shows: "e.g., Connection issues, game stuck, etc."
**And** the dialog has two buttons: "Propose Abandon" (primary) and "Cancel" (neutral)

### AC-3: Send Propose Abandon Command

**Given** the propose abandon dialog is open
**When** I enter a reason (e.g., "Connection issues") and click "Propose Abandon"
**Then** a `ProposeAbandon { player: [my_seat], reason: "Connection issues" }` command is sent
**And** the dialog closes
**And** a loading indicator shows: "Proposing abandon..."

### AC-4: Abandon Vote Started Event

**Given** I proposed abandon
**When** the server processes the proposal
**Then** a `AbandonVoteStarted { proposer: [my_seat], reason, timer: 30 }` event is broadcast to all players
**And** all 4 players see a voting panel
**And** a 30-second countdown timer starts

### AC-5: Voting Panel Displayed

**Given** an abandon vote has started
**When** the voting panel is displayed
**Then** it shows the proposer's name and reason
**And** it displays: "[Proposer] proposes abandoning the game. Reason: [reason]"
**And** it has two voting buttons: "Approve Abandon" (green) and "Deny Abandon" (red)
**And** a countdown timer shows remaining seconds: "Time left: 28s"
**And** current vote tally is displayed: "Votes: 1/4 (need 2+)"

### AC-6: Cast Vote

**Given** the voting panel is displayed
**When** I click "Approve Abandon" or "Deny Abandon"
**Then** a `VoteAbandon { player: [my_seat], approve: true/false }` command is sent
**And** my vote button is disabled
**And** my vote is displayed: "You voted: Approve" or "You voted: Deny"
**And** the vote tally updates: "Votes: 2/4"

### AC-7: Vote Tally Updates in Real-Time

**Given** the voting panel is displayed
**When** other players cast their votes
**Then** the vote tally updates in real-time
**And** I see which players have voted (without seeing their choice): "Alice voted, Bob voted, Carol pending, Dave pending"
**And** the approve/deny count updates: "Approve: 2, Deny: 1, Pending: 1"

### AC-8: Voting Ends - Approved (2+ Votes)

**Given** 2 or more players voted "Approve"
**When** the vote threshold is met or timer expires
**Then** a `AbandonVoteResult { approved: true, votes }` event is received
**And** a message displays: "Abandon approved (2+ votes). Game will end."
**And** followed by `GameAbandoned { reason: "VotedAbandon", initiator }` event

### AC-9: Voting Ends - Denied (Less than 2 Votes)

**Given** less than 2 players voted "Approve"
**When** the timer expires or all players voted
**Then** a `AbandonVoteResult { approved: false, votes }` event is received
**And** a message displays: "Abandon denied. Game continues."
**And** the voting panel closes after 3 seconds
**And** the game resumes normally

### AC-10: Game Abandoned - No Score Changes

**Given** the abandon vote was approved
**When** the `GameAbandoned` event is processed
**Then** all players return to the lobby
**And** no score changes are applied (no wins, no penalties)
**And** a toast notification shows: "Game abandoned by mutual agreement."
**And** the game is marked as "Abandoned" in game history

## Technical Details

### Commands (Frontend → Backend)

```typescript
// Propose abandon
{
  ProposeAbandon: {
    player: Seat;
    reason: string; // Optional text, can be empty
  }
}

// Vote on abandon proposal
{
  VoteAbandon: {
    player: Seat;
    approve: boolean; // true = approve, false = deny
  }
}
```

**Example Payloads:**

```typescript
// Propose with reason
{
  ProposeAbandon: {
    player: { South: {} },
    reason: "Connection issues making game unplayable"
  }
}

// Propose without reason
{
  ProposeAbandon: {
    player: { East: {} },
    reason: ""
  }
}

// Approve vote
{
  VoteAbandon: {
    player: { West: {} },
    approve: true
  }
}

// Deny vote
{
  VoteAbandon: {
    player: { North: {} },
    approve: false
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
// Abandon vote started
{
  kind: 'Public',
  event: {
    AbandonVoteStarted: {
      proposer: Seat;
      proposer_name: string;
      reason: string;
      timer: number;  // seconds, e.g., 30
      timestamp: number;
    }
  }
}

// Vote cast by a player
{
  kind: 'Public',
  event: {
    AbandonVoteCast: {
      player: Seat;
      has_voted: true;  // true/false (choice is private)
    }
  }
}

// Vote result
{
  kind: 'Public',
  event: {
    AbandonVoteResult: {
      approved: boolean;
      votes: Record<Seat, boolean>;  // Map of seat to approve/deny
      approve_count: number;
      deny_count: number;
    }
  }
}

// Game abandoned (if approved)
{
  kind: 'Public',
  event: {
    GameAbandoned: {
      reason: "VotedAbandon" | "Timeout" | "ServerError";
      initiator: Seat;  // Who proposed
      timestamp: number;
    }
  }
}
```

**Private Events:**

```typescript
// Confirmation that my vote was counted
{
  kind: 'Private',
  event: {
    VoteConfirmed: {
      player: Seat;
      approve: boolean;
    }
  }
}
```

**Error Events:**

```typescript
// Vote in progress, cannot propose again
{
  kind: 'Private',
  event: {
    Error: {
      code: "VoteInProgress",
      message: "An abandon vote is already in progress"
    }
  }
}

// Already voted
{
  kind: 'Private',
  event: {
    Error: {
      code: "AlreadyVoted",
      message: "You have already cast your vote"
    }
  }
}
```

### Backend References

- **Rust Code**: `crates/mahjong_server/src/network/voting.rs:handle_abandon_vote()` - Voting logic
- **Rust Code**: `crates/mahjong_core/src/table/voting.rs:AbandonVote` - Vote state machine
- **Rust Code**: `crates/mahjong_server/src/network/session.rs:handle_game_abandoned()` - Abandon handler
- **Game Design Doc**: Section 7.5 (Abandon Game Voting), Section 9.4 (Voting Mechanics)

## Components Involved

### Container Components

- **`<GameMenu>`** - Contains propose abandon button
- **`<ProposeAbandonDialog>`** - Dialog for reason input
- **`<AbandonVotePanel>`** - Voting panel (similar to undo vote panel from US-023)

### Presentational Components

- **`<ProposeAbandonButton>`** - Button to initiate vote
- **`<VotingTimer>`** - Countdown timer display
- **`<VoteTally>`** - Shows vote counts and status
- **`<VoteButtons>`** - Approve/Deny buttons
- **`<VoteStatusIndicator>`** - Shows who has voted

### Hooks

- **`useAbandonVote()`** - Handles abandon vote logic and state
- **`useVotingTimer()`** - Manages countdown timer

## Component Specs

**Component Specification Files:**

- `component-specs/container/ProposeAbandonDialog.md`
- `component-specs/container/AbandonVotePanel.md`
- `component-specs/presentational/ProposeAbandonButton.md`
- `component-specs/presentational/VotingTimer.md`
- `component-specs/presentational/VoteTally.md`
- `component-specs/hooks/useAbandonVote.md`

## Test Scenarios

**Test Scenario Files:**

- `tests/test-scenarios/abandon-vote-approved.md` - Vote passes with 2+ approvals
- `tests/test-scenarios/abandon-vote-denied.md` - Vote fails with <2 approvals
- `tests/test-scenarios/abandon-vote-timeout.md` - Timer expires before all vote
- `tests/test-scenarios/abandon-vote-unanimous.md` - All 4 players approve
- `tests/test-scenarios/multiple-abandon-proposals.md` - Sequential abandon attempts

## Mock Data

### Fixtures

**Game State Fixtures:**

```json
// tests/fixtures/game-states/abandon-vote-in-progress.json
{
  "table_id": "table_789",
  "phase": {
    "Playing": {
      "stage": "Discarding"
    }
  },
  "abandon_vote": {
    "active": true,
    "proposer": { "South": {} },
    "reason": "Connection issues",
    "timer_seconds": 30,
    "votes": {
      "East": null,
      "South": true,
      "West": null,
      "North": null
    },
    "started_at": 1706634000000
  }
}

// tests/fixtures/game-states/abandon-vote-completed.json
{
  "table_id": "table_789",
  "phase": {
    "Playing": {
      "stage": "Discarding"
    }
  },
  "abandon_vote": {
    "active": false,
    "result": {
      "approved": true,
      "votes": {
        "East": true,
        "South": true,
        "West": false,
        "North": null
      },
      "approve_count": 2,
      "deny_count": 1
    }
  }
}
```

**Sample Event Sequences:**

```json
// tests/fixtures/events/abandon-vote-approved.json
{
  "scenario": "Abandon Vote Approved (2+ Votes)",
  "initial_state": "playing_discarding",
  "events": [
    {
      "kind": "Public",
      "event": {
        "AbandonVoteStarted": {
          "proposer": { "South": {} },
          "proposer_name": "Bob",
          "reason": "Connection issues making game unplayable",
          "timer": 30,
          "timestamp": 1706634000000
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AbandonVoteCast": {
          "player": { "East": {} },
          "has_voted": true
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AbandonVoteCast": {
          "player": { "West": {} },
          "has_voted": true
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AbandonVoteResult": {
          "approved": true,
          "votes": {
            "East": true,
            "South": true,
            "West": false,
            "North": null
          },
          "approve_count": 2,
          "deny_count": 1
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "GameAbandoned": {
          "reason": "VotedAbandon",
          "initiator": { "South": {} },
          "timestamp": 1706634015000
        }
      }
    }
  ],
  "expected_ui_state": {
    "view": "lobby",
    "toast_message": "Game abandoned by mutual agreement.",
    "game_history_status": "Abandoned"
  }
}

// tests/fixtures/events/abandon-vote-denied.json
{
  "scenario": "Abandon Vote Denied (<2 Votes)",
  "initial_state": "playing_discarding",
  "events": [
    {
      "kind": "Public",
      "event": {
        "AbandonVoteStarted": {
          "proposer": { "North": {} },
          "proposer_name": "Dave",
          "reason": "Want to restart",
          "timer": 30,
          "timestamp": 1706634000000
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AbandonVoteCast": {
          "player": { "East": {} },
          "has_voted": true
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AbandonVoteCast": {
          "player": { "South": {} },
          "has_voted": true
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AbandonVoteCast": {
          "player": { "West": {} },
          "has_voted": true
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AbandonVoteResult": {
          "approved": false,
          "votes": {
            "East": false,
            "South": false,
            "West": false,
            "North": true
          },
          "approve_count": 1,
          "deny_count": 3
        }
      }
    }
  ],
  "expected_ui_state": {
    "vote_panel_closed": true,
    "toast_message": "Abandon denied. Game continues.",
    "game_phase": "Playing"
  }
}
```

## Edge Cases

### EC-1: Timer Expires Before All Vote

**Given** an abandon vote is in progress with 25 seconds remaining
**And** only 2 players have voted (1 approve, 1 deny)
**When** the 30-second timer expires
**Then** the vote is automatically finalized with current votes
**And** if approve_count < 2, vote is denied
**And** if approve_count >= 2, vote is approved
**And** non-voters are counted as abstaining (no effect on result)

### EC-2: Unanimous Approval (All 4 Players Approve)

**Given** an abandon vote is in progress
**When** all 4 players vote "Approve"
**Then** the vote passes immediately (no need to wait for timer)
**And** `AbandonVoteResult { approved: true }` is emitted
**And** game is abandoned within 2 seconds

### EC-3: Vote in Progress, Another Player Tries to Propose

**Given** an abandon vote is currently in progress
**When** another player clicks "Propose Abandon"
**Then** an error message shows: "An abandon vote is already in progress. Please wait."
**And** the propose abandon button is disabled until vote completes

### EC-4: Player Already Voted, Tries to Vote Again

**Given** I have already voted "Approve"
**When** I try to click "Deny Abandon" (change my vote)
**Then** both vote buttons are disabled
**And** my original vote stands (cannot change)
**And** a message shows: "You have already voted: Approve"

### EC-5: Game Ends Naturally During Vote

**Given** an abandon vote is in progress
**When** a player declares Mahjong before the vote completes
**Then** the abandon vote is automatically cancelled
**And** the game proceeds to score calculation
**And** the voting panel closes
**And** a message shows: "Vote cancelled. Game ended naturally."

### EC-6: Network Disconnection During Vote

**Given** I am in an active abandon vote
**When** my network disconnects for 10 seconds
**Then** when I reconnect, the voting panel is restored
**And** if I haven't voted yet, I can still vote (if time remains)
**And** if I already voted, my vote is preserved
**And** the timer continues from where it was

## Related User Stories

- **US-023: Request Undo (Voting)** - Similar voting mechanism for undo requests
- **US-031: Leave Game** - Alternative exit (individual, bot takeover)
- **US-032: Forfeit Game** - Alternative exit (individual, penalty)

## Accessibility Considerations

### Keyboard Navigation

**Focus Management:**

- "Propose Abandon" button is accessible via Tab
- Voting panel opens with focus on first button
- Tab key navigates between "Approve" and "Deny" buttons
- Enter or Space key casts vote
- Escape key does nothing (cannot cancel vote once started)

**Shortcuts:**

- No shortcuts to prevent accidental proposals
- Explicit button click required for safety

### Screen Reader

**Announcements:**

- Button label: "Propose abandoning game. Opens dialog to provide reason."
- Dialog opens: "Propose abandon game. Enter optional reason."
- Vote starts: "Abandon vote started by Bob. Reason: Connection issues. You have 30 seconds to vote. Choose approve or deny."
- Vote cast: "You voted to approve abandon. Waiting for other players."
- Vote result (approved): "Abandon approved with 2 votes. Game will end."
- Vote result (denied): "Abandon denied with 1 vote. Game continues."
- Timer update: "20 seconds remaining." (announced every 10 seconds)

**ARIA Labels:**

- `aria-label="Propose abandon game"` on propose button
- `aria-label="Approve abandoning game"` on approve button
- `aria-label="Deny abandoning game"` on deny button
- `aria-live="polite"` on vote tally
- `aria-live="assertive"` on vote result notification

### Visual

**High Contrast:**

- Voting panel has prominent border and shadow
- Approve button is green, Deny button is red
- Timer is large and bold (yellow/orange when <10s)
- Vote tally uses icons + numbers for clarity

**Motion:**

- Voting panel slide-in animation respects `prefers-reduced-motion`
- Timer countdown is smooth or step-based on settings

## Priority

**MEDIUM** - Nice-to-have for handling problematic games; not essential but improves UX

## Story Points / Complexity

**5** - Medium-High Complexity

**Justification:**

- Propose abandon: straightforward UI
- Voting panel: moderate complexity (real-time updates, timer)
- Vote counting logic: threshold calculation (2+ votes)
- Real-time synchronization: vote updates across all players
- Timer management: countdown with auto-finalize

**Complexity Factors:**

- Real-time vote tally updates via WebSocket
- 30-second countdown timer with UI updates
- Vote threshold logic (2+ votes to approve)
- Handling timer expiration and early completion
- Cancellation when game ends naturally

## Definition of Done

### Core Functionality

- [ ] "Propose Abandon" button visible in game menu
- [ ] Button is enabled during active gameplay
- [ ] Click button opens propose abandon dialog
- [ ] Dialog has optional reason text input
- [ ] Dialog has "Propose Abandon" and "Cancel" buttons
- [ ] Click "Propose Abandon" sends `ProposeAbandon` command with reason

### Voting Panel

- [ ] `AbandonVoteStarted` event displays voting panel
- [ ] Panel shows proposer name and reason
- [ ] Panel has "Approve Abandon" (green) and "Deny Abandon" (red) buttons
- [ ] Panel displays countdown timer (30 seconds)
- [ ] Panel shows vote tally: "Votes: 2/4 (need 2+)"
- [ ] Panel shows who has voted (without their choice)

### Voting Flow

- [ ] Click approve/deny sends `VoteAbandon` command
- [ ] Vote buttons are disabled after voting
- [ ] My vote is displayed: "You voted: Approve/Deny"
- [ ] `AbandonVoteCast` events update vote tally in real-time
- [ ] Timer counts down and updates every second
- [ ] Vote auto-finalizes when timer expires or all players vote

### Vote Results

- [ ] `AbandonVoteResult` event shows final vote counts
- [ ] If approved (2+ votes): message "Abandon approved. Game will end."
- [ ] If denied (<2 votes): message "Abandon denied. Game continues."
- [ ] Approved: `GameAbandoned` event navigates to lobby
- [ ] Denied: voting panel closes after 3 seconds, game resumes

### Edge Cases

- [ ] Timer expiration finalizes vote with current votes
- [ ] Unanimous approval (4/4) passes vote immediately
- [ ] Cannot propose while vote in progress
- [ ] Cannot change vote after casting
- [ ] Vote cancelled if game ends naturally
- [ ] Network disconnection preserves vote state

### Testing

- [ ] Unit tests pass for ProposeAbandonDialog, AbandonVotePanel
- [ ] Integration test passes (propose → vote → result)
- [ ] E2E test passes (approved vote → game abandoned → lobby)
- [ ] Timer test passes (countdown → auto-finalize)
- [ ] Real-time update test passes (vote tally syncs across clients)

### Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Screen reader announces vote start, timer updates, result
- [ ] ARIA labels on all interactive elements
- [ ] Focus management correct (panel open, vote cast)
- [ ] High contrast mode supported (green/red buttons, bold timer)

### Documentation & Quality

- [ ] Component specs created (ProposeAbandonDialog, AbandonVotePanel)
- [ ] Test scenarios documented (abandon-vote-\*.md files)
- [ ] Mock data fixtures created (events, game states)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

### User Testing

- [ ] Manually tested against `user-testing-plan.md` (Part 7, Abandon Game)
- [ ] Tested with multiple vote outcomes (approved, denied, timeout)
- [ ] Verified real-time vote tally updates with multiple clients
- [ ] Confirmed timer countdown is accurate

## Notes for Implementers

### Abandon Vote Flow

```typescript
// useAbandonVote hook
const useAbandonVote = () => {
  const [voteInProgress, setVoteInProgress] = useState(false);
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [voteTally, setVoteTally] = useState({ approve: 0, deny: 0, pending: 4 });
  const [timeRemaining, setTimeRemaining] = useState(30);

  const proposeAbandon = async (reason: string) => {
    try {
      await sendCommand({ ProposeAbandon: { player: mySeat, reason } });
    } catch (error) {
      showError('Failed to propose abandon. Please try again.');
    }
  };

  const castVote = async (approve: boolean) => {
    if (myVote !== null) {
      showError('You have already voted.');
      return;
    }

    try {
      await sendCommand({ VoteAbandon: { player: mySeat, approve } });
      setMyVote(approve);
    } catch (error) {
      showError('Failed to cast vote. Please try again.');
    }
  };

  return { voteInProgress, myVote, voteTally, timeRemaining, proposeAbandon, castVote };
};
```

### Event Handlers

```typescript
// Abandon vote started
case 'AbandonVoteStarted':
  setVoteInProgress(true);
  setProposer(event.proposer_name);
  setReason(event.reason);
  setTimeRemaining(event.timer);
  startTimer();
  showNotification(`${event.proposer_name} proposes abandoning the game. Reason: ${event.reason}`);
  break;

// Vote cast by a player
case 'AbandonVoteCast':
  updateVoteTally(event.player);
  break;

// Vote result
case 'AbandonVoteResult':
  setVoteInProgress(false);
  if (event.approved) {
    showNotification(`Abandon approved (${event.approve_count} votes). Game will end.`);
  } else {
    showNotification(`Abandon denied (${event.approve_count} votes). Game continues.`);
    setTimeout(() => closeVotePanel(), 3000);
  }
  break;

// Game abandoned
case 'GameAbandoned':
  showToast('Game abandoned by mutual agreement.');
  navigate('/lobby');
  break;
```

### Voting Panel Component

```typescript
<Dialog open={voteInProgress} maxWidth="sm" fullWidth>
  <DialogTitle>Abandon Game Vote</DialogTitle>
  <DialogContent>
    <Alert severity="info" sx={{ mb: 2 }}>
      {proposer} proposes abandoning the game.
      {reason && <><br />Reason: {reason}</>}
    </Alert>

    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="h6">Time left: {timeRemaining}s</Typography>
      <Typography variant="h6">
        Votes: {voteTally.approve + voteTally.deny}/4 (need 2+)
      </Typography>
    </Box>

    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
      <Button
        variant="contained"
        color="success"
        onClick={() => castVote(true)}
        disabled={myVote !== null}
        fullWidth
      >
        Approve Abandon
      </Button>
      <Button
        variant="contained"
        color="error"
        onClick={() => castVote(false)}
        disabled={myVote !== null}
        fullWidth
      >
        Deny Abandon
      </Button>
    </Box>

    {myVote !== null && (
      <Alert severity={myVote ? 'success' : 'error'}>
        You voted: {myVote ? 'Approve' : 'Deny'}
      </Alert>
    )}

    <VoteStatusDisplay voteTally={voteTally} />
  </DialogContent>
</Dialog>
```

### Timer Management

```typescript
// useVotingTimer hook
const useVotingTimer = (initialTime: number, onExpire: () => void) => {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);

  useEffect(() => {
    if (timeRemaining <= 0) {
      onExpire();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, onExpire]);

  return timeRemaining;
};
```

### Backend Vote Counting Logic (Reference)

```rust
// crates/mahjong_core/src/table/voting.rs (pseudo-code)
pub struct AbandonVote {
    pub proposer: Seat,
    pub reason: String,
    pub votes: HashMap<Seat, Option<bool>>,
    pub started_at: Instant,
    pub timer_seconds: u64,
}

impl AbandonVote {
    pub fn is_approved(&self) -> bool {
        let approve_count = self.votes.values()
            .filter(|&&v| v == Some(true))
            .count();

        approve_count >= 2 // Threshold: 2+ votes
    }

    pub fn is_complete(&self) -> bool {
        // All players voted
        self.votes.values().all(|v| v.is_some()) ||
        // Timer expired
        self.started_at.elapsed().as_secs() >= self.timer_seconds
    }
}
```

### Testing Abandon Vote

```typescript
// tests/integration/abandon-vote.test.ts
test('abandon vote approved with 2+ votes', async () => {
  const game = createMockGame();

  // South proposes abandon
  await sendCommand({ ProposeAbandon: { player: { South: {} }, reason: 'Connection issues' } });

  // Expect vote started event
  expect(mockSocket).toHaveEmitted({
    event: { AbandonVoteStarted: { proposer: { South: {} }, timer: 30 } },
  });

  // East votes approve
  await sendCommand({ VoteAbandon: { player: { East: {} }, approve: true } });

  // West votes approve (2nd approval)
  await sendCommand({ VoteAbandon: { player: { West: {} }, approve: true } });

  // Expect vote result (approved)
  await waitFor(() => {
    expect(mockSocket).toHaveEmitted({
      event: { AbandonVoteResult: { approved: true, approve_count: 2 } },
    });
  });

  // Expect game abandoned event
  expect(mockSocket).toHaveEmitted({
    event: { GameAbandoned: { reason: 'VotedAbandon' } },
  });
});
```

This comprehensive test covers the happy path for abandon voting.
