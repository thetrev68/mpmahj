# Phase 11: Charleston Advanced Features

**Priority:** MEDIUM
**Estimated Complexity:** Medium-High
**Dependencies:** Phase 10 (for general command pattern knowledge)

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

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Only valid during `Charleston(CourtesyAcross)` phase
- Requires negotiation/agreement from across partner

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

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Only valid during `Charleston(CourtesyAcross)` phase after negotiation
- Cannot pass Jokers (backend validates)

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

**Current Status:**

- Command builder: Needs to be created in `apps/client/src/utils/commands.ts`
- Validation: Only valid if house rule is enabled
- Player must have a Blank in their hand
- Secret action - other players don't know which tile was taken

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

### ProposeCourtesyPass

- [ ] Button only appears during Charleston(CourtesyAcross) phase
- [ ] Can propose 0, 1, 2, or 3 tiles
- [ ] Across partner sees proposal notification
- [ ] Partner can accept or counter-propose
- [ ] Agreement reached before proceeding

### AcceptCourtesyPass

- [ ] Tile selection only allows negotiated count
- [ ] Cannot select Jokers
- [ ] Backend rejects Joker attempts
- [ ] Tiles successfully passed to across partner
- [ ] Both players receive tiles simultaneously

### ExchangeBlank

- [ ] Button only appears when player has Blank and house rule enabled
- [ ] Can click any tile in discard pile
- [ ] Correct tile is added to hand
- [ ] Blank is removed from hand
- [ ] Other players don't see which tile was taken
- [ ] Handle multiple identical tiles correctly (discard_index)

---

## Files to Modify

### New Files

- `apps/client/src/components/CourtesyPassDialog.tsx` - Negotiation UI
- `apps/client/src/components/BlankExchangeDialog.tsx` - Discard pile selection
- `apps/client/src/components/CourtesyTileSelector.tsx` - Tile selection after agreement

### Modified Files

- `apps/client/src/components/TurnActions.tsx` - Add courtesy pass UI hooks
- `apps/client/src/utils/commands.ts` - Add command builders
- `apps/client/src/store/uiStore.ts` - Add courtesy pass negotiation state
- `apps/client/src/store/gameStore.ts` - Handle negotiation events if they affect authoritative state

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
