# Phase 10: Core Gameplay Completeness

**Priority:** HIGH
**Estimated Complexity:** Medium
**Dependencies:** None
**Status:** ✅ IMPLEMENTED (Ready for Backend Testing)

## Overview

Complete the essential in-game actions that are missing from the current UI. These are fundamental gameplay mechanics that should be available to properly test the backend.

**Important accuracy notes:**

- Client command helpers live in `apps/client/src/utils/commands.ts` (not `Commands.ts`).
- Exposed meld UI currently lives in `apps/client/src/components/HandDisplay.tsx` (no `ExposedMeld.tsx` file).
- UI modal/dialog state should live in `apps/client/src/store/uiStore.ts`, not `gameStore`.
- The UI currently ignores Setup phases; `ReadyToStart` is **not** a WaitingForPlayers action.

## Commands to Implement (4)

### 1. DrawTile ✅

**Backend Location:** [command.rs:71](../../../crates/mahjong_core/src/command.rs#L71)

**Description:** Draw a tile from the wall during the player's turn.

**Implementation Status:** ✅ COMPLETE

- Command builder: EXISTS in `apps/client/src/utils/commands.ts:199`
- UI: Implemented in `apps/client/src/components/TurnActions.tsx:142-154`
- "Draw Tile" button visible only during `Playing(Drawing)` phase when it's your turn
- Button disappears after draw, transitioning to discard phase
- Validation: Only sends command during `TurnStage::Drawing` when it's your turn

**Implementation Notes:**

- Draw is server-authoritative; client only sends `DrawTile` when conditions are met
- East automatically skips drawing on first turn (handled by backend)
- After drawing, `TileDrawnPrivate` event updates hand and enables discard UI

---

### 2. ExchangeJoker ✅

**Backend Location:** [command.rs:108](../../../crates/mahjong_core/src/command.rs#L108)

**Description:** Exchange a Joker from an exposed meld with a real tile from your hand.

**Parameters:**

- `target_seat`: Which player's exposed meld contains the Joker
- `meld_index`: Which of their exposed melds (0-based index)
- `replacement`: The real tile being traded for the Joker

**Implementation Status:** ✅ COMPLETE

- Command builder: EXISTS in `apps/client/src/utils/commands.ts:183`
- Dialog: Implemented in `apps/client/src/components/JokerExchangeDialog.tsx`
- UI state: Added to `apps/client/src/store/uiStore.ts:55-58,220-230`
- Exposed melds UI: Updated in `apps/client/src/components/HandDisplay.tsx:256-280`
- "Exchange Joker" button appears on other players' melds containing jokers
- Only available during `Playing(Discarding)` phase when it's your turn
- Dialog shows required tile based on `meld.joker_assignments[index]` or `meld.called_tile`
- Validates player has the correct replacement tile before sending command
- Error feedback shown if validation fails

**Design Implementation:**

- Used explicit "Exchange Joker" button on opponent melds (not automatic)
- Button only visible during Discarding phase on melds with jokers
- Dialog automatically determines required tile from joker assignments
- Handles multiple jokers by showing first joker found in meld
- Players can only exchange during their Discarding phase

---

### 3. AddToExposure ✅

**Backend Location:** [command.rs:133](../../../crates/mahjong_core/src/command.rs#L133)

**Description:** Upgrade an exposed meld by adding a tile during your turn (Pung→Kong, Kong→Quint, Quint→Sextet).

**Parameters:**

- `meld_index`: Which of player's exposed melds to upgrade (0-based)
- `tile`: The tile being added from player's hand

**Implementation Status:** ✅ COMPLETE

- Command builder: CREATED in `apps/client/src/utils/commands.ts:218`
- Dialog: Implemented in `apps/client/src/components/MeldUpgradeDialog.tsx`
- UI state: Added to `apps/client/src/store/uiStore.ts:60-63,232-242`
- Exposed melds UI: Updated in `apps/client/src/components/HandDisplay.tsx:188-239`
- Event handler: Added to `apps/client/src/store/gameStore.ts:344-357`
- "Upgrade" button appears on your own melds when upgrade is possible
- Only available during `Playing(Discarding)` phase when it's your turn
- Dialog shows current meld type and next upgrade (e.g., Pung→Kong)
- Shows all tiles from hand that can be used (matching tile or joker)
- Cannot upgrade Sextet (already maximum)

**Design Implementation:**

- Used inline "Upgrade" button directly on meld (easy to discover)
- Button only visible when player has tile to upgrade during Discarding phase
- Dialog lists all matching tiles/jokers from hand as clickable options
- `MeldUpgraded` event updates meld_type in exposed_melds
- Replacement draw handled by backend `ReplacementDrawn` event
- UI correctly waits for replacement before allowing discard

---

### 4. RollDice ✅

**Backend Location:** [command.rs:35](../../../crates/mahjong_core/src/command.rs#L35)

**Description:** East player rolls dice to determine wall break point during Setup phase.

**Implementation Status:** ✅ COMPLETE

- Command builder: CREATED in `apps/client/src/utils/commands.ts:213`
- UI: Implemented in `apps/client/src/components/TurnActions.tsx:117-138`
- Setup phase routing: Added in `apps/client/src/components/TurnActions.tsx:41-52`
- "Roll Dice" button visible only during `Setup(RollingDice)` phase
- Only shown to East player (dealer)
- Other players see "Waiting for East to roll dice..." message
- Backend handles dice result and wall break via `DiceRolled` and `WallBroken` events
- Auto-transitions to next phase after successful roll (handled by backend)

**Design Implementation:**

- Manual dice roll (not auto-triggered) - East must click button
- No dice animation (keeping implementation minimal for backend testing)
- Dice result displayed in event log
- Transition timing controlled by backend phase changes

---

## Setup Phase Actions ✅

**Implementation Status:** ✅ FIXED

The UI previously showed `ReadyToStart` in `WaitingForPlayers`, which was incorrect. This has been corrected:

- ✅ `RollDice`: Now shows only in `Setup(RollingDice)` and only to East player
- ✅ `ReadyToStart`: Now shows only in `Setup(OrganizingHands)` for each player
- ✅ Setup phase routing: Implemented in `apps/client/src/components/TurnActions.tsx:41-52`
- ✅ Other setup stages show "Setup in progress..." message

---

## Testing Checklist

**Status:** Ready for Backend Integration Testing

**UI Implementation:**

- ✅ DrawTile: Button appears during Drawing phase, sends command correctly
- ✅ ExchangeJoker: Dialog shows correct required tile, validates player has it
- ✅ ExchangeJoker: Dialog shows error if player doesn't have required tile
- ✅ AddToExposure: Upgrade button appears on upgradeable melds
- ✅ AddToExposure: Dialog shows Pung→Kong, Kong→Quint, Quint→Sextet progression
- ✅ AddToExposure: Cannot upgrade Sextet (button doesn't appear)
- ✅ RollDice: Only East can see/click button during Setup(RollingDice)
- ✅ RollDice: Other players see "Waiting for East to roll dice..." message
- ✅ ReadyToStart: Only available during Setup(OrganizingHands)
- ✅ MeldUpgraded: Event handler updates meld_type in exposed_melds

**Backend Integration Testing Needed:**

- [ ] DrawTile: Verify backend adds tile to hand and transitions to Discarding
- [ ] DrawTile: Verify East skips draw on first turn (backend logic)
- [ ] ExchangeJoker: Verify backend swaps joker with replacement tile
- [ ] ExchangeJoker: Verify backend rejects incorrect replacement tile
- [ ] AddToExposure: Verify backend upgrades meld and sends MeldUpgraded event
- [ ] AddToExposure: Verify backend sends ReplacementDrawn after upgrade
- [ ] RollDice: Verify backend generates dice result and sends DiceRolled event
- [ ] RollDice: Verify backend breaks wall at correct position based on dice
- [ ] ReadyToStart: Verify backend transitions from OrganizingHands to next phase
- [ ] All commands: Verify backend rejects commands when phase/turn invalid

---

## Files Modified ✅

### New Files Created

- ✅ `apps/client/src/components/JokerExchangeDialog.tsx` - Dialog for exchanging jokers from opponent melds
- ✅ `apps/client/src/components/MeldUpgradeDialog.tsx` - Dialog for upgrading player's own melds
- ✅ `apps/client/src/components/JokerExchangeDialog.css` - Shared styling for both dialogs

### Modified Files

- ✅ `apps/client/src/components/TurnActions.tsx` - Added DrawTile, RollDice buttons; fixed ReadyToStart phase logic; added Setup phase routing
- ✅ `apps/client/src/components/HandDisplay.tsx` - Added Joker exchange UI for opponent melds; added upgrade UI for player melds; split into "Your Melds" and "Other Players' Melds" sections
- ✅ `apps/client/src/components/HandDisplay.css` - Added styles for upgrade/exchange buttons and other players' melds section
- ✅ `apps/client/src/utils/commands.ts` - Added `rollDice()` and `addToExposure()` command builders
- ✅ `apps/client/src/store/uiStore.ts` - Added dialog state for joker exchange and meld upgrade
- ✅ `apps/client/src/store/gameStore.ts` - Added `MeldUpgraded` event handler (DiceRolled/WallBroken already handled)
- ✅ `apps/client/src/App.tsx` - Added dialog components to render tree

---

## Success Criteria

### Frontend Implementation ✅

- ✅ All 4 commands can be triggered from UI
- ✅ Commands are only available when valid (phase/turn checking implemented)
- ✅ Error states are handled gracefully with validation dialogs
- ✅ TypeScript compiles without errors
- ✅ Build succeeds (verified with `npm run build`)

### Ready for Backend Testing

- **DrawTile**: UI sends command during Drawing phase
- **ExchangeJoker**: Dialog validates replacement tile, sends command with correct parameters
- **AddToExposure**: Dialog shows upgrade path, sends command with meld index and tile
- **RollDice**: Button restricted to East during Setup(RollingDice) phase
- **ReadyToStart**: Button shows during Setup(OrganizingHands) instead of WaitingForPlayers
- **Event Handling**: MeldUpgraded updates meld_type; UI expects ReplacementDrawn after upgrades

### Backend Integration Verification Needed

- [ ] Verify backend validates and processes all commands correctly
- [ ] Verify UI updates reflect backend state changes via events
- [ ] Test full game flow from Setup → Charleston → Playing with all new commands
- [ ] Verify edge cases (invalid commands, wrong phase, wrong player)

---

## Implementation Summary

**Date Completed:** 2026-01-25

**Frontend Implementation:** ✅ COMPLETE

All core gameplay commands are now accessible from the UI:

1. **DrawTile** - Button appears during Drawing phase for current player
2. **ExchangeJoker** - "Exchange Joker" button on opponent melds with jokers during Discarding phase
3. **AddToExposure** - "Upgrade" button on player's own melds (Pung→Kong→Quint→Sextet) during Discarding phase
4. **RollDice** - Button for East player only during Setup(RollingDice) phase

**Phase Logic Fixed:**

- ReadyToStart now correctly shows during Setup(OrganizingHands) instead of WaitingForPlayers
- Setup phase routing properly implemented with stage-specific actions

**UI Components:**

- Two new dialog components for joker exchange and meld upgrades
- Updated HandDisplay to show both player and opponent melds with action buttons
- Updated TurnActions with Setup phase support and Drawing phase action

**Next Steps:**

- Connect to backend server at `ws://localhost:3000/ws`
- Test all commands in actual gameplay scenarios
- Verify backend event handling for MeldUpgraded, DiceRolled, WallBroken, ReplacementDrawn
- Validate phase transitions and turn management work correctly with new commands
