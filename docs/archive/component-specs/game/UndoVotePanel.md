# UndoVotePanel

## Purpose

Displays undo request voting UI. Shows who requested undo, target move, current votes, and voting buttons for other players.

## User Stories

- US-022: Undo request system
- US-023: Voting on undo requests

## Props

```typescript
interface UndoVotePanelProps {
  /** Active undo request (null if none) */
  undoRequest: { requester: Seat; target_move: number } | null;

  /** Current player's seat */
  currentSeat: Seat;

  /** Votes received so far (tracked client-side via events) */
  votes: Record<Seat, boolean | null>;

  /** Callback when player votes */
  onVote: (approve: boolean) => void;

  /** Voting deadline (seconds remaining) */
  timeRemaining?: number;
}
```

## Behavior

### Request Display

- Show requester name and avatar
- Show target move description: "Undo to Move 42 (North's discard)"
- Display current votes with player indicators
- Show countdown timer

### Voting

- **Current player hasn't voted:** Show "Approve" / "Deny" buttons
- **Current player voted:** Show their vote, disable buttons
- **Requester:** Show "Waiting for votes..." (can't vote on own request)

### Vote Tracking

Visual indicators:

- ✅ Approved
- ❌ Denied
- ⏳ Pending

### Resolution

- **All approve:** "Undo approved! Reverting..."
- **Any deny:** "Undo denied"
- **Timeout:** "Vote expired - undo denied"

## Visual Requirements

```text
┌────────────────────────────────────────┐
│ ⏮️ Undo Request           ⏱️ 12s      │
├────────────────────────────────────────┤
│ North wants to undo to Move 42         │
│ "North's discard of 3 Dot (20)"        │
│                                        │
│ Votes:                                 │
│ • East:  ✅ Approved                   │
│ • South: ⏳ Pending (You)              │
│ • West:  ✅ Approved                   │
│ • North: (Requester)                   │
│                                        │
│ [ Approve ✅ ]  [ Deny ❌ ]             │
└────────────────────────────────────────┘
```

## Related Components

- **Used by**: `<GameBoard>`, game UI overlay
- **Uses**: shadcn/ui `<Card>`, `<Button>`, `<Badge>`
- **Integrates with**: Backend `SmartUndo`, `VoteUndo` commands, `UndoRequested`/`UndoVoteRegistered` events

## Implementation Notes

### Request Undo

```typescript
const requestUndo = async () => {
  await sendCommand({ SmartUndo: { player: currentSeat } });
  // Backend emits UndoRequested event
};
```

### Vote on Undo

```typescript
const handleVote = async (approve: boolean) => {
  await sendCommand({
    VoteUndo: { player: currentSeat, approve },
  });
  // Backend emits UndoVoteRegistered event
};
```

### Event Handling

```typescript
useEffect(() => {
  const handleUndoEvents = (event: Event) => {
    if (event.Public?.UndoRequested) {
      setUndoRequest({
        requester: event.Public.UndoRequested.requester,
        target_move: event.Public.UndoRequested.target_move,
      });
    }

    if (event.Public?.UndoVoteRegistered) {
      setVotes((prev) => ({
        ...prev,
        [event.Public.UndoVoteRegistered.voter]: event.Public.UndoVoteRegistered.approved,
      }));
    }

    if (event.Public?.UndoRequestResolved) {
      // Clear on resolution
      setUndoRequest(null);
    }
  };

  gameStore.subscribe(handleUndoEvents);
}, []);
```

### Countdown Timer

```typescript
useEffect(() => {
  if (!undoRequest) return;

  const interval = setInterval(() => {
    const now = Date.now();
    const expires = new Date(undoRequest.expires_at).getTime();
    setTimeRemaining(Math.max(0, Math.floor((expires - now) / 1000)));
  }, 1000);

  return () => clearInterval(interval);
}, [undoRequest]);
```

## Accessibility

- Dialog: `role="alertdialog"` (interrupts gameplay)
- Buttons: `aria-label="Approve undo request"` / `aria-label="Deny undo request"`
- Timer: `aria-live="polite"` announces time remaining

## Example Usage

```tsx
<UndoVotePanel
  undoRequest={currentUndoRequest}
  currentSeat="South"
  onVote={handleVote}
  timeRemaining={12}
/>
```

## Edge Cases

1. **Multiple votes in rapid succession:** Update UI optimistically
2. **Request expired before vote:** Disable buttons
3. **Player disconnects during vote:** Backend auto-denies
4. **Requester only player:** Auto-approve (practice mode)

---

**Estimated Complexity**: Medium (~80 lines)
**Dependencies**: shadcn/ui Card, Button, Badge
**Phase**: Phase 6 - Polish & Advanced (Optional)
