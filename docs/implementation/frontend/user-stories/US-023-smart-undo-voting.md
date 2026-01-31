# US-023: Smart Undo (Voting - Multiplayer)

## Story

**As a** player in a multiplayer game
**I want** to propose an undo that requires all players to vote and approve
**So that** mistakes can be corrected with group consensus

## Acceptance Criteria

### AC-1: Propose Undo (Multiplayer)

**Given** I am in a multiplayer game (2+ human players)
**When** I complete an action and want to undo
**Then** an "Request Undo Vote" button appears
**And** clicking it sends `ProposeUndo { player: me, reason: "Accidental discard" }`

### AC-2: Undo Vote Initiated

**Given** I proposed undo
**When** the server emits `UndoVoteStarted { proposer: me, reason, timer: 30 }`
**Then** all players see a voting panel: "Approve Undo?" / "Deny Undo?"
**And** a 30-second timer starts
**And** my request reason is shown: "South requests undo: Accidental discard"

### AC-3: Vote Approve

**Given** the undo vote is active
**When** I click "Approve Undo"
**Then** `VoteUndo { player: me, approve: true }` is sent
**And** a checkmark appears next to my name

### AC-4: Vote Result (Unanimous Approve)

**Given** all 4 players voted "Approve"
**When** votes complete
**Then** `UndoVoteResult { approved: true }` is emitted
**And** `StateRestored { move_number, description, mode: Voting }` follows
**And** the game state is restored
**And** a message: "Undo approved - game state restored"

### AC-5: Vote Result (Any Deny)

**Given** at least one player voted "Deny"
**When** votes complete
**Then** `UndoVoteResult { approved: false }` is emitted
**And** a message: "Undo denied - game continues"
**And** no state change occurs

### AC-6: Timer Expiry (Auto-Deny)

**Given** the vote timer reaches 0 and not all players voted
**Then** missing votes count as "Deny"
**And** undo is denied

### AC-7: Undo Limit (Multiplayer)

**Given** undo has been used 3 times in this game
**Then** "Request Undo Vote" button is disabled
**And** message: "Undo limit reached (3 per game)"

## Technical Details

### Commands

````typescript
{
  ProposeUndo: {
    player: Seat,
    reason: string  // Optional explanation
  }
}

{
  VoteUndo: {
    player: Seat,
    approve: boolean
  }
}
```text

### Events

```typescript
{
  kind: 'Public',
  event: {
    UndoVoteStarted: {
      proposer: Seat,
      reason: string,
      timer: 30,
      started_at_ms: number
    }
  }
}

{
  kind: 'Public',
  event: {
    PlayerVotedUndo: {
      player: Seat
      // Vote value hidden until complete
    }
  }
}

{
  kind: 'Public',
  event: {
    UndoVoteResult: {
      approved: boolean,
      votes: Record<Seat, boolean>
    }
  }
}
```text

### Backend References

- `crates/mahjong_core/src/command.rs` - `ProposeUndo`, `VoteUndo`
- `crates/mahjong_core/src/history.rs` - Voting undo logic

## Components Involved

- **`<UndoVotePanel>`** - Voting UI
- **`<UndoVoteResult>`** - Result display

## Related Stories

- US-022: Smart Undo (Solo) - Solo variant
- US-005: Charleston Voting - Similar voting pattern

## Priority

**MEDIUM** - Multiplayer feature

## Story Points

**8** - High complexity (voting + state restoration)

## Definition of Done

- [ ] "Request Undo Vote" button in multiplayer games
- [ ] Propose undo sends command with reason
- [ ] All players see voting panel with 30s timer
- [ ] Vote approve/deny sends command
- [ ] Unanimous approve restores state
- [ ] Any deny cancels undo
- [ ] Timer expiry auto-denies
- [ ] Undo limit enforced (3 per game)
- [ ] Component tests pass
- [ ] Integration tests pass

## Notes

Voting undo requires ALL players to approve (not majority). This prevents griefing and ensures consensus.
````
