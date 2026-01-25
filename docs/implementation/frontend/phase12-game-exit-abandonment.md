# Phase 12: Game Exit & Abandonment

**Priority:** HIGH
**Estimated Complexity:** Medium
**Dependencies:** None

## Overview

Implement UI for players to leave, forfeit, or abandon games. These are critical game management features that allow graceful exits and proper backend state testing.

## Commands to Implement (3)

### 1. LeaveGame

**Backend Location:** [command.rs:171](../../../crates/mahjong_core/src/command.rs#L171)

**Description:** Leave the game at any time. Player status will be set to Disconnected.

**Current Status:**

- Command builder: Needs to be created
- Validation: Always allowed
- Effect: Player marked as Disconnected, game may continue with remaining players

**UI Requirements:**

- Add "Leave Game" button in game menu/settings
- Show confirmation dialog: "Are you sure you want to leave?"
- Explain consequences: "You will be marked as disconnected"
- Button available at all times (in any phase)
- After leaving, redirect to lobby or home screen
- Show reconnection option if implemented

**Design Considerations:**

- Should this be in main menu bar or settings?
- Different behavior for practice mode vs multiplayer?
- Can player rejoin after leaving?
- What happens to their hand/position?

---

### 2. ForfeitGame

**Backend Location:** [command.rs:226](../../../crates/mahjong_core/src/command.rs#L226)

**Description:** Forfeit the game early with optional reason. Game ends immediately with forfeiting player marked as loss.

**Parameters:**

- `reason`: Optional<String> - explanation for forfeiting

**Current Status:**

- Command builder: Needs to be created
- Validation: Always allowed
- Effect: Game ends immediately, forfeiting player loses, triggers GameOver event

**UI Requirements:**

- Add "Forfeit Game" button in game menu
- Show confirmation dialog with reason input (optional)
- Warning: "This will end the game immediately and count as a loss for you"
- Predefined reason options + custom text field:
  - "Personal emergency"
  - "Connection issues"
  - "Game is taking too long"
  - "Other" (custom text)
- Confirm/Cancel buttons
- After forfeit, show game over screen

**Design Considerations:**

- Should forfeit be different from leave?
- Forfeit ends game for everyone, leave just disconnects you
- Should there be a cooldown to prevent accidental clicks?
- Display forfeiter's reason to other players?

---

### 3. AbandonGame

**Backend Location:** [command.rs:176](../../../crates/mahjong_core/src/command.rs#L176)

**Description:** Vote to abandon the game early. Requires majority agreement (3/4 players) or single player if insufficient players.

**Parameters:**

- `reason`: AbandonReason enum (TooManyDisconnections, Timeout, MutualAgreement, InsufficientPlayers, etc.)

**Current Status:**

- Command builder: Needs to be created
- Validation: Requires majority vote (3/4 in 4-player game)
- Effect: If approved, game ends with no winner

**UI Requirements:**

- Add "Propose Abandon" button in game menu
- Show reason selection dialog:
  - Too many disconnections
  - Game timeout/stalling
  - Mutual agreement
  - Insufficient players
  - Other
- After proposing, show "Waiting for votes" status
- Display vote UI when another player proposes abandon
- Vote options: Approve / Decline
- Show voting progress: "2/4 players agreed"
- Majority approval → game ends
- Majority decline → proposal dismissed

**Design Considerations:**

- Should there be a timeout for votes?
- Can multiple abandon proposals be active simultaneously?
- What if different players propose different reasons?
- Should voting be anonymous or public?
- Can proposer cancel their proposal?

---

## Testing Checklist

### LeaveGame

- [ ] Button accessible from any game phase
- [ ] Confirmation dialog appears
- [ ] Player successfully leaves and is marked Disconnected
- [ ] Game continues for remaining players (if applicable)
- [ ] Player redirected to appropriate screen after leaving

### ForfeitGame

- [ ] Confirmation dialog with reason input appears
- [ ] Optional reason can be submitted
- [ ] Game ends immediately for all players
- [ ] Forfeiting player shown as loss in game over screen
- [ ] Other players notified of forfeit
- [ ] Reason displayed to other players (if provided)

### AbandonGame

- [ ] Reason selection dialog works
- [ ] Proposal broadcasts to all players
- [ ] Vote UI appears for other players
- [ ] Vote counting works correctly (3/4 threshold)
- [ ] Game abandons when majority approves
- [ ] Proposal dismissed when majority declines
- [ ] Multiple proposals handled correctly
- [ ] Timeout handling (if implemented)

---

## Files to Modify

### New Files

- `apps/client/src/components/GameMenu.tsx` - Centralized game menu with exit options
- `apps/client/src/components/ForfeitDialog.tsx` - Forfeit confirmation and reason
- `apps/client/src/components/AbandonDialog.tsx` - Abandon proposal and voting
- `apps/client/src/components/LeaveConfirmation.tsx` - Simple leave confirmation

### Modified Files

- `apps/client/src/App.tsx` - Add game menu button/icon
- `apps/client/src/api/Commands.ts` - Add command builders for all 3 commands
- `apps/client/src/store/gameStore.ts` - Add abandon vote state tracking
- `apps/client/src/hooks/useGameSocket.ts` - Handle GameOver, PlayerForfeited events

---

## Backend Events to Handle

### Expected Server Events

- `PlayerLeft { player: Seat }` - Player disconnected
- `PlayerForfeited { player: Seat, reason: Option<String> }` - Player forfeited
- `AbandonProposed { by: Seat, reason: AbandonReason }` - Abandon vote initiated
- `AbandonVote { player: Seat, approve: bool }` - Vote received
- `GameAbandoned { reason: AbandonReason }` - Game abandoned by majority
- `AbandonProposalDismissed` - Vote failed
- `GameOver { ... }` - Game ended (for forfeit/abandon)

### Error Events

- `InvalidCommand` - Edge cases (e.g., already voted, not in game)

---

## Type Definitions Needed

### AbandonReason Enum

Check if TypeScript binding exists for `AbandonReason`:

```typescript
enum AbandonReason {
  TooManyDisconnections,
  Timeout,
  MutualAgreement,
  InsufficientPlayers,
  Other,
}
```

If not auto-generated, need to create manually.

---

## Success Criteria

✅ Players can leave game at any time
✅ Leave redirects to appropriate screen
✅ Forfeit ends game immediately with reason
✅ Forfeit reason displayed to all players
✅ Abandon voting system works correctly
✅ 3/4 majority threshold enforced
✅ Abandon proposal can be dismissed
✅ All exit methods integrate with GameOver flow
✅ Backend state properly cleaned up after exit
