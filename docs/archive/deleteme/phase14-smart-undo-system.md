# Phase 14: Smart Undo System

**Priority:** HIGH
**Estimated Complexity:** Medium-High
**Dependencies:** None

## Overview

Implement the Smart Undo system that allows players to undo their last significant action. In practice mode, undo is instant. In multiplayer, undo requires unanimous consensus via voting.

**Important accuracy notes:**

- Command helpers live in `apps/client/src/utils/commands.ts`.
- Undo-related public events are `UndoRequested`, `UndoVoteRegistered`, and `UndoRequestResolved` (no action strings or explicit “executed” event).
- Undo execution is delivered via history/state restore flow (see history events and snapshots), not a single `UndoExecuted` event.

**Implementation status (current repo):**

- Smart undo/Vote undo command builders are implemented in `apps/client/src/utils/commands.ts`.
- Undo UI is implemented (`UndoButton`, `UndoVoteDialog`, `UndoAnimation`) and wired into `apps/client/src/components/TurnActions.tsx` and `apps/client/src/App.tsx`.
- Undo state and voting are handled in `apps/client/src/store/gameStore.ts` and `apps/client/src/hooks/useUndoState.ts`.
- Undo events are handled in `apps/client/src/store/gameStore.ts` (not `useGameSocket`).

## Commands to Implement (2)

### 1. SmartUndo

**Backend Location:** [command.rs:197](../../../crates/mahjong_core/src/command.rs#L197)

**Description:** Request to undo the last significant action (decision point).

**Current Status:**

- Command builder: **Implemented** in `apps/client/src/utils/commands.ts`
- Practice mode: **Implemented** (instant execution with animation)
- Multiplayer: **Implemented** (triggers voting process requiring unanimous approval)
- Undoes to last decision point (not just last move)
- UI: **Implemented** (button, status text, keyboard shortcut)

**UI Requirements:**

- Add "Undo" button in game controls
- Button enabled only when undo is possible
- Keyboard shortcut: Ctrl+Z / Cmd+Z
- Click behavior:
  - **Practice mode:** Immediate undo with brief animation
  - **Multiplayer:** Show "Undo requested" notification, trigger voting
- Show what action will be undone (e.g., "Undo discard of 5 Dot")
- Disable button while undo vote is pending
- Visual feedback during undo execution

**Design Considerations:**

- What actions are "significant" and can be undone? (discard, call, pass)
- What actions cannot be undone? (ready, vote, join game)
- Should there be a time limit on undo requests?
- How far back can you undo (just last action or multiple)?
- Should preview show game state after undo?

---

### 2. VoteUndo

**Backend Location:** [command.rs:201](../../../crates/mahjong_core/src/command.rs#L201)

**Description:** Vote on a pending undo request (multiplayer only).

**Parameters:**

- `approve`: bool - true to approve, false to decline

**Current Status:**

- Command builder: **Implemented** in `apps/client/src/utils/commands.ts`
- Validation: Only valid when an undo request is active
- Requires unanimous approval (all players must vote yes)
- If any player votes no, undo is rejected
- UI: **Implemented** (vote dialog with progress and per-seat status)

**UI Requirements:**

- Show vote dialog when another player requests undo:

  ```text
  ┌────────────────────────────────┐
  │ Undo Request                   │
  │                                │
  │ [Player] wants to undo:        │
  │ "Discard 5 Dot"                │
  │                                │
  │ [Approve] [Decline]            │
  └────────────────────────────────┘
  ```

- Show voting progress: "Waiting for votes: 2/4 approved"
- Display who voted and their choice (or keep anonymous?)
- Auto-close dialog after vote submitted
- Show result: "Undo approved" or "Undo declined"
- If approved, rewind game state with animation

**Design Considerations:**

- Should voting be anonymous or public?
- Should there be a vote timeout (auto-decline after X seconds)?
- What if a player disconnects during voting?
- Can requester cancel their undo request?
- Should there be a cooldown on undo requests?

---

## Testing Checklist

### SmartUndo - Practice Mode

- [ ] Undo button appears and is enabled after significant action
- [ ] Click undo → immediate rewind
- [ ] Game state correctly restored
- [ ] Hand, melds, discard pile all restored
- [ ] Turn indicator correct after undo
- [ ] Can undo multiple times in sequence
- [ ] Cannot undo past certain actions (game start, etc.)

### SmartUndo - Multiplayer Mode

- [ ] Undo button appears after significant action
- [ ] Click undo → triggers vote request
- [ ] All players receive vote dialog
- [ ] Requester sees "Waiting for votes" status
- [ ] Vote dialog shows what action will be undone

### VoteUndo

- [ ] Vote dialog appears for all players except requester
- [ ] Can vote Approve or Decline
- [ ] Vote is recorded correctly
- [ ] Unanimous approval → undo executes
- [ ] Any decline → undo rejected
- [ ] Vote result shown to all players
- [ ] Multiple undo requests queued/rejected properly

### Edge Cases

- [ ] Undo during call window
- [ ] Undo during Charleston
- [ ] Undo after Mahjong declaration
- [ ] Undo with pending calls
- [ ] Player disconnects during vote
- [ ] Multiple rapid undo requests
- [ ] Undo rejected → requester can request again?

---

## Files to Modify

### New Files

- `apps/client/src/components/UndoButton.tsx` - Main undo button component (**implemented**)
- `apps/client/src/components/UndoVoteDialog.tsx` - Vote UI for multiplayer (**implemented**)
- `apps/client/src/components/UndoAnimation.tsx` - Visual feedback for undo (**implemented**)
- `apps/client/src/hooks/useUndoState.ts` - Track undo availability (**implemented**)

### Modified Files

- `apps/client/src/App.tsx` - Add undo dialogs/animation (**implemented**)
- `apps/client/src/utils/commands.ts` - Add undo command builders (**implemented**)
- `apps/client/src/store/gameStore.ts` - Add undo vote state (**implemented**)
- `apps/client/src/hooks/useGameSocket.ts` - Handle undo events (**not required; handled in gameStore**)
- `apps/client/src/components/TurnActions.tsx` - Integrate undo button (**implemented**)

---

## Backend Events to Handle

### Expected Server Events

- `UndoRequested { requester: Seat, target_move: u32 }` - Undo vote initiated
- `UndoVoteRegistered { voter: Seat, approved: bool }` - Vote received
- `UndoRequestResolved { approved: bool }` - Approved or denied
- Follow-up state updates arrive via history/state restore events (e.g., `StateRestored`, `HistoryTruncated`) and snapshots

### Error Events

- `CommandRejected { player, reason }` - Wrong phase, already voted, no active request, etc.

---

## State Management

### Undo State

```typescript
interface UndoState {
  canUndo: boolean;
  lastAction?: string; // Description of action that can be undone
  lastActionSeat?: Seat;
  pendingRequest?: {
    requestedBy: Seat;
    action: string;
    votes: Record<Seat, boolean | null>;
  };
  isExecuting: boolean;
}
```text

### What Actions Can Be Undone?

Backend determines this, but likely includes:

- Discard tile
- Call/Pass decision
- Charleston tile passing
- Charleston vote
- Meld upgrades (AddToExposure)
- Joker exchange

---

## UI/UX Design

### Undo Button States

1. **Disabled** (grayed out): Nothing to undo
2. **Enabled**: Can request undo
3. **Pending**: Undo requested, waiting for votes
4. **Executing**: Undo approved, rewinding game

### Undo Animation

When undo executes:

- Brief rewind animation (optional)
- Tiles move back to previous positions
- Discard pile tile returns to hand
- Turn indicator moves back
- Smooth transition (not instant snap)

### Vote Dialog Design

```text
┌──────────────────────────────────┐
│  Undo Request                    │
├──────────────────────────────────┤
│                                  │
│  South wants to undo:            │
│  → "Discard 5 Dot"               │
│                                  │
│  This will rewind the game to    │
│  before this action.             │
│                                  │
│  ┌─────────┐  ┌─────────┐        │
│  │Approve  │  │ Decline │        │
│  └─────────┘  └─────────┘        │
│                                  │
│  Votes: East ✓ West ? North ?   │
└──────────────────────────────────┘
```text

---

## Success Criteria

✅ Undo works instantly in practice mode
✅ Undo triggers voting in multiplayer mode
✅ Unanimous approval required for multiplayer undo
✅ Game state correctly restored after undo
✅ UI clearly shows what action will be undone
✅ Vote dialog UX is clear and responsive
✅ Edge cases handled gracefully
✅ Keyboard shortcut (Ctrl+Z) works
✅ Animation provides smooth feedback
