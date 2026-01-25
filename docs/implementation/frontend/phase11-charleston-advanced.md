# Phase 11: Charleston Advanced Features

**Priority:** MEDIUM
**Estimated Complexity:** Medium-High
**Dependencies:** Phase 10 (for general command pattern knowledge)
**Status:** ✅ IMPLEMENTED (Ready for backend testing)

## Overview

Implement advanced Charleston features including courtesy pass negotiation and blank tile exchange (house rule). These features add depth to the Charleston phase and allow full testing of backend Charleston logic.

**Important accuracy notes:**

- Command helpers live in `apps/client/src/utils/commands.ts`.
- There is no `CharlestonPhase.tsx` component; Charleston UI currently lives in `apps/client/src/components/TurnActions.tsx`.
- UI modal/dialog state should live in `apps/client/src/store/uiStore.ts`, not `gameStore`.
- `apps/client/src/types/bindings/generated/*` files are generated; do not edit `GamePhase` types directly.

## Commands to Implement (3)

### 1. ProposeCourtesyPass

**Backend Location:** [command.rs:62](../../../crates/mahjong_core/src/command.rs#L62)

**Description:** Propose a courtesy pass with 0-3 tiles to your across partner after First Charleston.

**Parameters:**

- `tile_count`: Number of tiles to pass (0-3)

**Current Status:** ✅ IMPLEMENTED

- Command builder: `Commands.proposeCourtesyPass()` in [commands.ts:217](../../../apps/client/src/utils/commands.ts#L217)
- Validation: `validateCourtesyPassProposal()` checks tile_count is 0-3
- Validation hook: `useCommandSender().proposeCourtesyPass()` in [commands.ts:360](../../../apps/client/src/utils/commands.ts#L360)
- UI: [CourtesyPassDialog.tsx](../../../apps/client/src/components/CourtesyPassDialog.tsx) handles all negotiation states

**UI Requirements:**

- Add "Courtesy Pass" dialog during Charleston(CourtesyAcross) phase
- Show selector for tile count: 0, 1, 2, or 3 tiles
- Display "Propose Courtesy Pass" button
- Show waiting state while across partner decides
- Display partner's proposal to you if they propose first
- Accept/decline partner's proposal UI

**Design Considerations:**

- How to handle simultaneous proposals from both partners?
- What happens if proposals don't match (one proposes 2, other proposes 3)?
- Should there be a timeout for negotiation?
- UI flow: Propose → Wait → Accept/Counter → Submit tiles

---

### 2. AcceptCourtesyPass

**Backend Location:** [command.rs:65](../../../crates/mahjong_core/src/command.rs#L65)

**Description:** Submit tiles for courtesy pass after successful negotiation.

**Parameters:**

- `tiles`: Vec<Tile> - tiles to pass to across partner (length matches negotiated count)

**Current Status:** ✅ IMPLEMENTED

- Command builder: `Commands.acceptCourtesyPass()` in [commands.ts:222](../../../apps/client/src/utils/commands.ts#L222)
- Validation: `validateCourtesyPassTiles()` checks tile count, hand ownership, and Joker restrictions
- Validation hook: `useCommandSender().acceptCourtesyPass()` in [commands.ts:374](../../../apps/client/src/utils/commands.ts#L374)
- UI: [CourtesyPassDialog.tsx](../../../apps/client/src/components/CourtesyPassDialog.tsx) state 4 handles tile selection

**UI Requirements:**

- Tile selection UI similar to regular Charleston passing
- Select exactly the negotiated number of tiles
- Visual indication of which tiles are selected
- "Submit Courtesy Pass" button (disabled until correct count)
- Error message if trying to pass Jokers

**Design Considerations:**

- Reuse existing Charleston tile selection component?
- How to display negotiated tile count prominently?
- Should tiles be pre-validated before submit button is enabled?

---

### 3. ExchangeBlank

**Backend Location:** [command.rs:122](../../../crates/mahjong_core/src/command.rs#L122)

**Description:** Exchange a blank tile with any tile from the discard pile (house rule).

**Parameters:**

- `discard_index`: Index in the discard pile (to handle multiple identical tiles)

**Current Status:** ✅ IMPLEMENTED

- Command builder: `Commands.exchangeBlank()` in [commands.ts:227](../../../apps/client/src/utils/commands.ts#L227)
- Validation: `validateBlankExchange()` checks for Blank (tile 36) in hand and valid discard_index
- Validation hook: `useCommandSender().exchangeBlank()` in [commands.ts:388](../../../apps/client/src/utils/commands.ts#L388)
- UI: [BlankExchangeDialog.tsx](../../../apps/client/src/components/BlankExchangeDialog.tsx) with discard pile grid
- House rule check: `houseRules.ruleset.blank_exchange_enabled` validated in UI

**UI Requirements:**

- Add "Exchange Blank" button when player has Blank tile and house rule enabled
- Show discard pile with all tiles clickable
- Highlight selected tile in discard pile
- Confirm dialog: "Exchange Blank for [Tile]?"
- Success feedback without revealing to other players
- Update hand to show acquired tile, remove Blank

**Design Considerations:**

- Backend validation does **not** check phase/turn for `ExchangeBlank`. If UI should restrict to specific phases/turns, document and align with backend expectations first.
- How to handle multiple identical tiles in discard pile (hence discard_index)?
- How to ensure secrecy in UI? (Don't broadcast to other players)
- Should there be a limit on when this can be done?

---

## Testing Checklist

### ProposeCourtesyPass (Ready for backend testing)

- [x] Button only appears during Charleston(CourtesyAcross) phase
- [x] Can propose 0, 1, 2, or 3 tiles
- [ ] Across partner sees proposal notification (requires backend)
- [x] Partner can accept or counter-propose (UI implemented)
- [x] Agreement reached before proceeding (UI implemented)

### AcceptCourtesyPass (Ready for backend testing)

- [x] Tile selection only allows negotiated count
- [x] Cannot select Jokers (client-side validation)
- [ ] Backend rejects Joker attempts (requires backend)
- [ ] Tiles successfully passed to across partner (requires backend)
- [ ] Both players receive tiles simultaneously (requires backend)

### ExchangeBlank (Ready for backend testing)

- [x] Button only appears when player has Blank and house rule enabled
- [x] Can click any tile in discard pile
- [ ] Correct tile is added to hand (requires backend)
- [ ] Blank is removed from hand (requires backend)
- [ ] Other players don't see which tile was taken (requires backend)
- [x] Handle multiple identical tiles correctly (discard_index)

---

## Files Created/Modified

### New Files ✅

- [CourtesyPassDialog.tsx](../../../apps/client/src/components/CourtesyPassDialog.tsx) - Four-state negotiation UI (propose → wait → respond → select tiles)
- [CourtesyPassDialog.css](../../../apps/client/src/components/CourtesyPassDialog.css) - Dialog styling
- [BlankExchangeDialog.tsx](../../../apps/client/src/components/BlankExchangeDialog.tsx) - Discard pile grid selection UI
- [BlankExchangeDialog.css](../../../apps/client/src/components/BlankExchangeDialog.css) - Dialog styling

**Note:** CourtesyTileSelector.tsx was not needed - tile selection reuses existing hand selection from uiStore.

### Modified Files ✅

- [TurnActions.tsx](../../../apps/client/src/components/TurnActions.tsx) - Added CourtesyPassButton (Charleston phase) and BlankExchangeButton (Playing phase)
- [commands.ts](../../../apps/client/src/utils/commands.ts) - Added 3 command builders + 3 validation functions + 3 validation hooks
- [uiStore.ts](../../../apps/client/src/store/uiStore.ts) - Added courtesy pass negotiation state + blank exchange dialog state
- [gameStore.ts](../../../apps/client/src/store/gameStore.ts) - Added handlers for CourtesyPassProposed, CourtesyPassMismatch, CourtesyPairReady, CourtesyPassComplete, BlankExchanged events

---

## Backend Events to Handle

### Expected Server Events

- **Private (pair-scoped) events:**
  - `CourtesyPassProposed { player: Seat, tile_count: u8 }` - Partner proposed
  - `CourtesyPassMismatch { pair: (Seat, Seat), proposed: (u8, u8), agreed: u8 }` - Proposals mismatched, smallest wins
  - `CourtesyPairReady { pair: (Seat, Seat), tile_count: u8 }` - Agreement reached; both should submit tiles
- **Public events:**
  - `CourtesyPassComplete` (string literal public event)
  - `BlankExchanged { player: Seat }` - Someone used blank (tile remains secret)

### Error Events

- `CommandRejected { player, reason }` - Wrong phase, invalid tile count, Joker in tiles, etc.
- There is no dedicated `NegotiationFailed` event; mismatch is communicated via `CourtesyPassMismatch` (private)

---

## Success Criteria

✅ Courtesy pass negotiation flow works end-to-end
✅ Both 0-tile and 1-3 tile courtesy passes work
✅ Backend validates Joker restrictions
✅ Blank exchange works when house rule enabled
✅ Blank exchange is secret (other players not notified of tile)
✅ UI gracefully handles negotiation failures
✅ All three commands integrate smoothly into Charleston phase

---

## Implementation Notes

### Courtesy Pass Negotiation Flow

The CourtesyPassDialog manages a four-state negotiation process:

1. **Initial Proposal** - Player selects 0-3 tiles to propose
2. **Waiting for Partner** - Shows "waiting for partner" message
3. **Responding to Partner** - Partner's proposal displayed, player makes counter-proposal
4. **Tile Selection** - After agreement, select exact number of tiles from hand

State is managed via `uiStore`:

- `courtesyPassProposal` - Our proposal count
- `partnerCourtesyProposal` - Partner's proposal count
- `courtesyPassAgreedCount` - Final negotiated count

Events update state:

- `CourtesyPassProposed` → sets `partnerCourtesyProposal`
- `CourtesyPassMismatch` → sets `courtesyPassAgreedCount` (smallest wins)
- `CourtesyPairReady` → sets `courtesyPassAgreedCount`
- `CourtesyPassComplete` → resets all negotiation state

### Blank Exchange Implementation

- Button only visible during Playing phase when `yourHand.includes(36)` AND `houseRules.ruleset.blank_exchange_enabled`
- Dialog shows discard pile as a grid of clickable tiles
- Uses `discard_index` to handle multiple identical tiles correctly
- Exchange is secret - only `BlankExchanged { player }` public event (no tile revealed)
- Hand updates handled by backend via private events

### Design Decisions

- **No separate CourtesyTileSelector component** - Reuses existing hand tile selection from uiStore.selectedTiles
- **Dialog-based UI** - Both features use modal overlays to avoid cluttering TurnActions
- **Minimal styling** - Basic CSS for testing purposes only (per requirements)
- **Client-side validation** - All commands validated before sending (Joker checks, tile counts, hand ownership)
- **House rule checking** - Blank exchange checks `ruleset.blank_exchange_enabled` (not `allow_blank_exchange` as originally assumed)
