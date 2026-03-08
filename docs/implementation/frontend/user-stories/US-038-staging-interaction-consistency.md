# US-038: Staging Interaction Consistency (Hover, Ordering, No Glow)

## Status

- State: Not Started
- Priority: High
- Batch: C

## Problem

Staging interactions are inconsistent: hover elevation persists after move, outgoing order starts in middle, incoming tiles cannot always be interacted with, and staging glow is excessive.

## Scope

- Fix hover elevation: hover-lift CSS class must not persist after pointer leaves (no sticky hover state).
- Fix outgoing staging fill order: tiles always fill from slot 0 left-to-right.
- Fix incoming staging interaction: incoming tiles always accept hover and click (absorb/flip) in all valid contexts.
- Remove selected-glow styling from tiles once they are in staging (outgoing tiles currently use `state="selected"` in `StagingStrip.tsx` — change to `state="default"` or a new `"staged"` state).

## Acceptance Criteria

- AC-1: Hover elevation resets when the pointer leaves the tile — no persistent hover class after `mouseleave`.
- AC-2: Outgoing staged tiles always populate from slot 0 toward higher indices (left-to-right).
- AC-3: Incoming staged tiles are always clickable for flip/absorb when `blindIncoming=true`.
- AC-4: Tiles rendered inside staging slots do not carry `state="selected"` glow styling.

## Edge Cases

- EC-1: Blind incoming tile flip still works before absorb (existing `isHidden`/`onFlipIncoming` logic preserved).
- EC-2: Keyboard focus outline remains visible on staging tiles — ensure removing hover state does not remove `:focus-visible` styling.

## Primary Files (Expected)

- `apps/client/src/components/game/StagingStrip.tsx` — change outgoing tile `state="selected"` to `state="default"`; verify slot fill order
- `apps/client/src/components/game/Tile.tsx` — fix hover state to use React `onMouseLeave` reset, not CSS-only sticky class
- `apps/client/src/components/game/Tile.css` — remove or scope any CSS that persists hover-lift after `mouseleave`

## Notes for Implementer

- **AC-4 (glow fix)**: In `StagingStrip.tsx`, `renderOutgoingSlot` passes `state="selected"` to `<Tile>` (line ~147). Change this to `state="default"`. Outgoing tiles are already visually distinguished by their slot/context — the glow is redundant and confusing.
- **AC-1 (sticky hover)**: Look for `onMouseDown`/`onClick` handlers in `Tile.tsx` that add a CSS class for lift/elevation. If the class is added on click but only removed on `mouseleave`, it will persist after the mouse moves away before the pointer leaves. Ensure the lift class is driven by a `mouseenter`/`mouseleave` pair (CSS `:hover` is simplest), not by click state.
- **AC-2 (fill order)**: `StagingStrip.tsx` renders `outgoingTiles[index]` sequentially from slot 0 to `outgoingSlotCount - 1`. This is already left-to-right by array order. The issue is upstream: check that the `outgoingTiles` array passed from the parent always appends tiles to the end (not inserts in the middle). Look at how `CharlestonPhase.tsx` or the store builds `outgoingTiles`.
- **AC-3 (incoming interaction)**: Incoming tiles are only clickable when `isBlindTile` is true (i.e. `blindIncoming && tile !== undefined`). For non-blind incoming tiles (courtesy pass, etc.), no `onClick` is set. Verify non-blind incoming tiles do receive click-to-absorb when appropriate — read the caller context to understand when `blindIncoming` should be true.
- **`useTileSelection.ts`**: Not directly involved in staging interaction — it handles rack tile selection. Only modify it if AC-1 hover behavior is implemented there.

## Test Plan

- Update `StagingStrip.test.tsx`:
  - Assert that outgoing tiles rendered in slots 0, 1, 2 have `state="default"` (no glow class), not `state="selected"`.
  - Assert that slot 0 is filled before slot 1 when one tile is staged.
  - Assert incoming tile click calls `onAbsorbIncoming` when `blindIncoming=true` and tile is revealed.
- Update `Tile.test.tsx`:
  - Assert hover class is applied on `mouseenter` and removed on `mouseleave`.
  - Assert hover class is not present after a click when pointer is no longer over the tile.
