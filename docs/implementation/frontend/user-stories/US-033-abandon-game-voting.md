# US-033: Abandon Game (Consensus)

## Story

**As a** player in an active game
**I want** to propose abandoning the game and let the server resolve the consensus rule
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
**Then** an `AbandonGame { player: [my_seat], reason: MutualAgreement }` command is sent
**And** the dialog closes
**And** a loading indicator shows: "Proposing abandon..."

### AC-4: Pending State While Server Resolves

**Given** I proposed abandon
**When** the request is in flight
**Then** a loading state appears: "Waiting for abandon decision..."
**And** action buttons are disabled until the request resolves

### AC-5: Game Abandoned - No Score Changes

**Given** the server accepts the abandon request
**When** the `GameAbandoned` event is processed
**Then** all players return to the lobby
**And** no score changes are applied (no wins, no penalties)
**And** a toast notification shows: "Game abandoned by mutual agreement."
**And** the game is marked as "Abandoned" in game history

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  AbandonGame: {
    player: Seat;
    reason: "MutualAgreement"; // AbandonReason
  }
}
```text

**Example Payloads:**

```typescript
{
  AbandonGame: {
    player: { South: {} },
    reason: "MutualAgreement"
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
// Game abandoned
{
  kind: 'Public',
  event: {
    GameAbandoned: {
      reason: "MutualAgreement" | "InsufficientPlayers" | "Timeout" | "AllPlayersDead" | "Forfeit";
      initiator: Seat | null;
    }
  }
}
```text

### Backend References

- **Rust Code**: `crates/mahjong_core/src/command.rs` - `AbandonGame`
- **Rust Code**: `crates/mahjong_core/src/flow/outcomes.rs` - `AbandonReason`
- **Rust Code**: `crates/mahjong_core/src/event/public_events.rs` - `GameAbandoned`
- **Game Design Doc**: Section 7.5 (Abandon Game), Section 9.4 (Consensus Rules)

## Components Involved

### Container Components

- **`<GameMenu>`** - Contains propose abandon button
- **`<ProposeAbandonDialog>`** - Dialog for reason input
- **`<AbandonPendingPanel>`** - Pending status UI while server resolves

### Presentational Components

- **`<ProposeAbandonButton>`** - Button to initiate vote
- **`<PendingIndicator>`** - Shows request pending status

### Hooks

- **`useAbandonGame()`** - Handles abandon request and state

## Component Specs

**Component Specification Files:**

- `component-specs/container/ProposeAbandonDialog.md`
- `component-specs/container/AbandonPendingPanel.md`
- `component-specs/presentational/ProposeAbandonButton.md`
- `component-specs/presentational/PendingIndicator.md`
- `component-specs/hooks/useAbandonGame.md`

## Test Scenarios

**Test Scenario Files:**

- `tests/test-scenarios/abandon-game-accepted.md` - Abandon accepted by server
- `tests/test-scenarios/abandon-game-rejected.md` - Abandon rejected/blocked

## Mock Data

### Fixtures

**Game State Fixtures:**

```json
// tests/fixtures/game-states/abandon-pending.json
{
  "table_id": "table_789",
  "phase": {
    "Playing": {
      "stage": "Discarding"
    }
  },
  "abandon_pending": {
    "initiator": { "South": {} },
    "reason": "MutualAgreement"
  }
}

// tests/fixtures/game-states/abandon-completed.json
{
  "table_id": "table_789",
  "phase": {
    "Playing": {
      "stage": "Discarding"
    }
  },
  "abandon_result": {
    "approved": true,
    "reason": "MutualAgreement"
  }
}
```text

**Sample Event Sequences:**

```json
// tests/fixtures/events/abandon-game-accepted.json
{
  "scenario": "Abandon Accepted",
  "initial_state": "playing_discarding",
  "events": [
    {
      "kind": "Public",
      "event": {
        "GameAbandoned": {
          "reason": "MutualAgreement",
          "initiator": { "South": {} }
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
```text

## Edge Cases

### EC-1: Request Rejected

**Given** I propose abandoning the game
**When** the server rejects the request
**Then** a generic error message appears
**And** the pending state clears

### EC-2: Game Ends Naturally During Pending

**Given** the abandon request is pending
**When** a player declares Mahjong before the request resolves
**Then** the abandon flow is cancelled
**And** the game proceeds to scoring

### EC-3: Network Disconnection During Pending

**Given** my network disconnects while the abandon request is pending
**When** I reconnect
**Then** I see the final outcome (GameAbandoned or game continues)

## Related User Stories

- **US-023: Smart Undo (Voting)** - Separate consensus flow for undo
- **US-031: Leave Game** - Alternative exit (mark player disconnected)
- **US-032: Forfeit Game** - Alternative exit (individual, penalty)

## Accessibility Considerations

### Keyboard Navigation

**Focus Management:**

- "Propose Abandon" button is accessible via Tab
- Dialog opens with focus on the reason input
- Tab key navigates between input and confirm/cancel buttons
- Enter activates the focused button

**Shortcuts:**

- No shortcuts to prevent accidental proposals
- Explicit button click required for safety

### Screen Reader

**Announcements:**

- Button label: "Propose abandoning game. Opens dialog to provide reason."
- Dialog opens: "Propose abandon game. Enter optional reason."
- Pending: "Abandon request sent. Waiting for server decision."
- Result: "Game abandoned by mutual agreement." or "Abandon request denied."
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
- Pending state: simple in-flight handling
- Server resolves consensus; client only reflects result

**Complexity Factors:**

- Pending state handling and cancellation
- GameAbandoned flow and navigation

## Definition of Done

### Core Functionality

- [ ] "Propose Abandon" button visible in game menu
- [ ] Button is enabled during active gameplay
- [ ] Click button opens propose abandon dialog
- [ ] Dialog has optional reason text input
- [ ] Dialog has "Propose Abandon" and "Cancel" buttons
- [ ] Click "Propose Abandon" sends `AbandonGame` command with reason

### Pending/Result Flow

- [ ] Pending state shown while request is in flight
- [ ] `GameAbandoned` event navigates to lobby
- [ ] Error handling shows rejection message and clears pending state

### Edge Cases Verification

- [ ] Game ends naturally while pending cancels abandon flow
- [ ] Network disconnection resolves to final outcome on reconnect

### Testing

- [ ] Unit tests pass for ProposeAbandonDialog, AbandonPendingPanel
- [ ] Integration test passes (propose → GameAbandoned → lobby)
- [ ] E2E test passes (abandon accepted → lobby)

### Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Screen reader announces pending state and result
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
```text

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
```text

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
```text

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
```text

### Server-Side Consensus (Reference)

Abandon consensus is resolved server-side. The client only sends
`AbandonGame` and reacts to `GameAbandoned` or a rejection error.

```text

```text
```
