# Phase 10: Core Gameplay Completeness

**Priority:** HIGH
**Estimated Complexity:** Medium
**Dependencies:** None

## Overview

Complete the essential in-game actions that are missing from the current UI. These are fundamental gameplay mechanics that should be available to properly test the backend.

## Commands to Implement (4)

### 1. DrawTile

**Backend Location:** [command.rs:71](../../../crates/mahjong_core/src/command.rs#L71)

**Description:** Draw a tile from the wall during the player's turn.

**Current Status:**

- Command builder: May need to check if exists
- Validation: Only valid during `Playing(Drawing { player })` phase
- Likely auto-triggered server-side, but manual trigger may be needed for testing

**UI Requirements:**

- Add "Draw Tile" button in TurnActions component
- Only visible during `Playing(Drawing)` phase when it's player's turn
- Button should be prominent and clearly indicate it's the player's action
- After drawing, button should disappear and discard UI should appear

**Implementation Notes:**

- Check if server auto-triggers draw or expects client command
- May need to coordinate with turn state management

---

### 2. ExchangeJoker

**Backend Location:** [command.rs:108](../../../crates/mahjong_core/src/command.rs#L108)

**Description:** Exchange a Joker from an exposed meld with a real tile from your hand.

**Parameters:**

- `target_seat`: Which player's exposed meld contains the Joker
- `meld_index`: Which of their exposed melds (0-based index)
- `replacement`: The real tile being traded for the Joker

**Current Status:**

- Command builder: EXISTS at [Commands.ts:118](../../../apps/client/src/api/Commands.ts#L118)
- Backend validation: Replacement must match the tile the Joker represents
- Player receives the Joker after successful exchange

**UI Requirements:**

- Add visual indicator on exposed melds that contain Jokers
- Click on Joker in opponent's meld to initiate exchange
- Show dialog to select which tile from hand to use as replacement
- Validate player has the correct tile before sending command
- Show feedback if exchange is successful or fails

**Design Considerations:**

- Should clicking an exposed Joker automatically select it if player has replacement?
- Or require explicit "Exchange Joker" mode/button first?
- How to handle multiple Jokers in same meld?

---

### 3. AddToExposure

**Backend Location:** [command.rs:133](../../../crates/mahjong_core/src/command.rs#L133)

**Description:** Upgrade an exposed meld by adding a tile during your turn (Pung→Kong, Kong→Quint, Quint→Sextet).

**Parameters:**

- `meld_index`: Which of player's exposed melds to upgrade (0-based)
- `tile`: The tile being added from player's hand

**Current Status:**

- Command builder: Needs to be created
- Backend validation: Only valid during `Playing(Discarding)` phase on player's turn
- Player can add-to-exposure before discarding

**UI Requirements:**

- Add "Upgrade Meld" action before discard phase
- Visual indicator on player's own exposed melds that can be upgraded
- Show which tiles in hand can upgrade which melds
- Click exposed meld → select tile from hand → confirm upgrade
- Update UI to show upgraded meld immediately

**Design Considerations:**

- Should this be a separate button or integrated into meld UI?
- How to make it discoverable for beginners?
- Consider adding hint when player has upgrade opportunity

---

### 4. RollDice

**Backend Location:** [command.rs:35](../../../crates/mahjong_core/src/command.rs#L35)

**Description:** East player rolls dice to determine wall break point during Setup phase.

**Current Status:**

- Command builder: Needs to be created
- Validation: Only valid during `Setup(RollingDice)` phase
- Only East player can roll

**UI Requirements:**

- Add "Roll Dice" button visible only during Setup(RollingDice) phase
- Only show to East player
- Button should trigger dice roll animation (optional but nice)
- Display dice result after roll
- Auto-transition to next phase after successful roll

**Design Considerations:**

- Is dice roll always manual or can it auto-trigger?
- Should there be a visual dice animation?
- How long to display result before transitioning?

---

## Testing Checklist

- [ ] DrawTile: Verify tile is added to hand and turn proceeds to discard
- [ ] ExchangeJoker: Verify Joker moves to player's hand and replacement goes to meld
- [ ] ExchangeJoker: Verify validation fails if wrong tile is offered
- [ ] AddToExposure: Verify Pung→Kong upgrade works
- [ ] AddToExposure: Verify Kong→Quint upgrade works
- [ ] AddToExposure: Verify Quint→Sextet upgrade works
- [ ] RollDice: Verify only East can roll during Setup
- [ ] RollDice: Verify dice result determines wall break correctly

---

## Files to Modify

### New Files

- `apps/client/src/components/JokerExchangeDialog.tsx` (new component)
- `apps/client/src/components/MeldUpgradeDialog.tsx` (new component)

### Modified Files

- `apps/client/src/components/TurnActions.tsx` - Add DrawTile, RollDice buttons
- `apps/client/src/components/ExposedMeld.tsx` - Add Joker exchange and upgrade UI
- `apps/client/src/api/Commands.ts` - Add missing command builders
- `apps/client/src/store/gameStore.ts` - Add state for upgrade/exchange dialogs

---

## Success Criteria

✅ All 4 commands can be triggered from UI
✅ Backend validates and processes commands correctly
✅ UI updates reflect backend state changes
✅ Error states are handled gracefully
✅ Commands are only available when valid (phase/turn checking)
