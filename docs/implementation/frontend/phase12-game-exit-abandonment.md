# Phase 12: Game Exit & Abandonment

**Priority:** HIGH
**Estimated Complexity:** Medium
**Dependencies:** None

## Overview

Implement UI for players to leave, forfeit, or abandon games. These are critical game management features that allow graceful exits and proper backend state testing.

**Important accuracy notes:**

- Command helpers live in `apps/client/src/utils/commands.ts`.
- `AbandonReason` bindings already exist in `apps/client/src/types/bindings/generated/AbandonReason.ts`.
- There are **no** public events for abandon voting (proposal/votes). `AbandonGame` immediately ends the game via `GameAbandoned` + `GameOver`.
- `LeaveGame` currently only sets player status to `Disconnected` on the server; there is no dedicated `PlayerLeft` public event.

## Commands to Implement (3)

### 1. LeaveGame

**Backend Location:** [command.rs:171](../../../crates/mahjong_core/src/command.rs#L171)

**Description:** Leave the game at any time. Player status will be set to Disconnected.

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
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

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
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

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Immediate (no vote flow in current backend)
- Effect: Game ends immediately with no winner (`GameAbandoned` then `GameOver`)

**UI Requirements:**

- Add "Propose Abandon" button in game menu
- Show reason selection dialog:
  - Too many disconnections
  - Game timeout/stalling
  - Mutual agreement
  - Insufficient players
  - Other
- If you want voting, backend changes are required; otherwise this is a simple confirm-and-send flow.

**Design Considerations:**

- No voting exists in the current backend. If you need voting, define new commands + events first.

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
- `apps/client/src/utils/commands.ts` - Add command builders for all 3 commands
- `apps/client/src/store/gameStore.ts` - Add abandon vote state tracking
- `apps/client/src/hooks/useGameSocket.ts` - GameOver/PlayerForfeited already flow through `Event` handling; add UI routing if needed

---

## Backend Events to Handle

### Expected Server Events

- `PlayerForfeited { player: Seat, reason: Option<String> }` - Player forfeited
- `GameAbandoned { reason: AbandonReason, initiator: Option<Seat> }` - Game abandoned
- `GameOver { ... }` - Game ended (for forfeit/abandon)

### Error Events

- `CommandRejected { player, reason }` - Edge cases (wrong phase, not in game, etc.)

---

## Type Definitions Needed

### AbandonReason Enum

Binding already exists (`apps/client/src/types/bindings/generated/AbandonReason.ts`). Current variants:

```typescript
'MutualAgreement' | 'InsufficientPlayers' | 'Forfeit' | 'Timeout' | 'AllPlayersDead';
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
