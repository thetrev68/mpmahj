# Phase 12: Game Exit & Abandonment

**Priority:** HIGH
**Estimated Complexity:** Medium
**Dependencies:** None

## Overview

Implement UI for players to leave, forfeit, or abandon games. These are critical game management features that allow graceful exits and proper backend state testing.

**Implementation Status:** ✅ **COMPLETE** - All UI components and command builders implemented. Ready for backend integration testing.

## How to Test

1. Start the game server and client
2. Create or join a game with multiple players
3. During gameplay, click the **"Game Menu"** button (appears next to "View Card" button)
4. Test each exit option:
   - **Leave Game:** Confirm dialog appears, player disconnects but game continues
   - **Forfeit Game:** Select reason (or custom text), game ends immediately with forfeit
   - **Abandon Game:** Select AbandonReason, game ends with no winner

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

- Command builder: ✅ **IMPLEMENTED** in `apps/client/src/utils/commands.ts` (`Commands.leaveGame()`)
- Validation: Always allowed
- Effect: Player marked as Disconnected, game may continue with remaining players
- UI Component: ✅ **IMPLEMENTED** - `LeaveConfirmation.tsx` with confirmation dialog

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

- Command builder: ✅ **IMPLEMENTED** in `apps/client/src/utils/commands.ts` (`Commands.forfeitGame()`)
- Validation: Always allowed
- Effect: Game ends immediately, forfeiting player loses, triggers GameOver event
- UI Component: ✅ **IMPLEMENTED** - `ForfeitDialog.tsx` with predefined reasons + custom text input

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

- Command builder: ✅ **IMPLEMENTED** in `apps/client/src/utils/commands.ts` (`Commands.abandonGame()`)
- Validation: Immediate (no vote flow in current backend)
- Effect: Game ends immediately with no winner (`GameAbandoned` then `GameOver`)
- UI Component: ✅ **IMPLEMENTED** - `AbandonDialog.tsx` with AbandonReason enum selection

**UI Requirements:**

- Add "Propose Abandon" button in game menu
- Show reason selection dialog:
  - Too many disconnections / insufficient players
  - Game timeout/stalling
  - Mutual agreement
  - Treat as forfeit (no winner)
  - All players dead / no win possible
- If you want voting, backend changes are required; otherwise this is a simple confirm-and-send flow.

**Note:** AbandonReason is a closed enum; there is no custom "Other" text field. All options map directly to the AbandonReason variants.

**Design Considerations:**

- No voting exists in the current backend. If you need voting, define new commands + events first.

---

## Testing Checklist

### LeaveGame

- [x] Button accessible from any game phase (via Game Menu button)
- [x] Confirmation dialog appears (LeaveConfirmation.tsx)
- [ ] Player successfully leaves and is marked Disconnected (backend integration test)
- [ ] Game continues for remaining players (backend integration test)
- [x] Player redirected to appropriate screen after leaving (calls leaveRoom())

### ForfeitGame

- [x] Confirmation dialog with reason input appears (ForfeitDialog.tsx)
- [x] Optional reason can be submitted (predefined + custom text field)
- [ ] Game ends immediately for all players (backend integration test)
- [ ] Forfeiting player shown as loss in game over screen (backend integration test)
- [ ] Other players notified of forfeit (backend integration test)
- [ ] Reason displayed to other players (backend integration test)

### AbandonGame

- [x] Reason selection dialog works (AbandonDialog.tsx with AbandonReason enum)
- [ ] Command sent to backend successfully (backend integration test)
- [ ] Game abandons immediately (backend integration test)
- [ ] All players notified via GameAbandoned event (backend integration test)

**Note:** Voting features (proposal/vote UI) are NOT implemented because backend executes AbandonGame immediately without voting. If voting is needed, backend changes are required first.

---

## Files to Modify

### New Files (All ✅ **IMPLEMENTED**)

- ✅ `apps/client/src/components/GameMenu.tsx` - Centralized game menu with exit options
- ✅ `apps/client/src/components/GameMenu.css` - Styling for game menu dropdown
- ✅ `apps/client/src/components/ForfeitDialog.tsx` - Forfeit confirmation and reason input
- ✅ `apps/client/src/components/AbandonDialog.tsx` - Abandon reason selection (no voting UI - not in backend)
- ✅ `apps/client/src/components/LeaveConfirmation.tsx` - Simple leave confirmation dialog

### Modified Files (All ✅ **IMPLEMENTED**)

- ✅ `apps/client/src/App.tsx` - Added "Game Menu" button and rendered all exit dialogs
- ✅ `apps/client/src/utils/commands.ts` - Added command builders: `leaveGame()`, `forfeitGame()`, `abandonGame()`
- ✅ `apps/client/src/store/uiStore.ts` - Added dialog state for game menu and all exit dialogs
- ⏭️ `apps/client/src/store/gameStore.ts` - No changes needed (no voting state required)
- ⏭️ `apps/client/src/hooks/useGameSocket.ts` - No changes needed (events already handled)

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
```text

If not auto-generated, need to create manually.

---

## Success Criteria

### Frontend Implementation (All ✅ Complete)

✅ Players can leave game at any time (UI button + command implemented)
✅ Leave calls leaveRoom() to exit WebSocket room
✅ Forfeit dialog with optional reason input implemented
✅ Forfeit sends ForfeitGame command with reason
✅ Abandon dialog with AbandonReason enum selection implemented
✅ Abandon sends AbandonGame command immediately (no voting UI - not in backend)
✅ Game menu accessible during any game phase
✅ All dialogs follow existing pattern (reuse JokerExchangeDialog.css)
✅ TypeScript compiles without errors

### Backend Integration Testing (Pending Backend Testing)

⏳ Leave command marks player as Disconnected on server
⏳ Forfeit command ends game and triggers GameOver event
⏳ Forfeit reason displayed to all players via event
⏳ Abandon command ends game with GameAbandoned + GameOver events
⏳ Backend state properly cleaned up after exit
⏳ Remaining players can continue after one player leaves

**Note:** Voting system (3/4 majority threshold) is NOT implemented because backend executes AbandonGame immediately without voting flow.
