# Phase 11: Charleston Advanced Features

**Priority:** MEDIUM
**Estimated Complexity:** Medium-High
**Dependencies:** Phase 10 (for general command pattern knowledge)

## Overview

Implement advanced Charleston features including courtesy pass negotiation and blank tile exchange (house rule). These features add depth to the Charleston phase and allow full testing of backend Charleston logic.

## Commands to Implement (3)

### 1. ProposeCourtesyPass

**Backend Location:** [command.rs:62](../../../crates/mahjong_core/src/command.rs#L62)

**Description:** Propose a courtesy pass with 0-3 tiles to your across partner after First Charleston.

**Parameters:**

- `tile_count`: Number of tiles to pass (0-3)

**Current Status:**

- Command builder: Needs to be created
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

- Command builder: Needs to be created
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

- Command builder: Needs to be created
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

- Should this be available only during player's turn or anytime?
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

- `apps/client/src/components/CharlestonPhase.tsx` - Add courtesy pass UI hooks
- `apps/client/src/api/Commands.ts` - Add command builders
- `apps/client/src/store/gameStore.ts` - Add courtesy pass negotiation state
- `apps/client/src/types/GamePhase.ts` - Ensure Charleston substates are tracked

---

## Backend Events to Handle

### Expected Server Events

- `CourtesyPassProposed { by: Seat, tile_count: u8 }` - Partner proposed
- `CourtesyPassAgreed { tile_count: u8 }` - Negotiation successful
- `CourtesyPassCompleted` - Both players submitted tiles
- `BlankExchanged { player: Seat }` - Someone used blank (but not which tile)

### Error Events

- `InvalidCommand` - Wrong phase, invalid tile count, Joker in tiles, etc.
- `NegotiationFailed` - Proposals don't match, timeout

---

## Success Criteria

✅ Courtesy pass negotiation flow works end-to-end
✅ Both 0-tile and 1-3 tile courtesy passes work
✅ Backend validates Joker restrictions
✅ Blank exchange works when house rule enabled
✅ Blank exchange is secret (other players not notified of tile)
✅ UI gracefully handles negotiation failures
✅ All three commands integrate smoothly into Charleston phase
