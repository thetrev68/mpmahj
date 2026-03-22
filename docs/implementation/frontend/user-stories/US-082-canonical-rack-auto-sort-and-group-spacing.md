# US-082: Canonical Rack Auto-Sort and Group Spacing

## Status

- State: Proposed
- Priority: High
- Batch: L
- Implementation Ready: Yes

## Problem

The client currently uses inconsistent tile ordering across the player rack and shared tile
utilities.

Today:

- [`tileUtils.ts`](c:/Repos/mpmahj/apps/client/src/lib/utils/tileUtils.ts) still documents the
  old sort contract and sorts numerically.
- [`PlayerRack.tsx`](c:/Repos/mpmahj/apps/client/src/components/game/PlayerRack.tsx) applies its
  own inline numeric sort instead of using a canonical comparator.
- The local rack still exposes a redundant `Sort` button even though the product direction is
  automatic organization rather than manual cleanup.

This makes quick hand assessment harder than it needs to be. American Mahjong players need the
concealed rack to read as intentional groups, with dragons visually attached to their suit-color
families and subtle spacing between groups.

## Scope

**In scope:**

- Define one canonical client-facing tile order and use it consistently anywhere the rack
  auto-sorts tiles.
- Replace numeric sort behavior with a shared comparator derived from the tile asset reference in
  [`apps/client/src/assets/tiles/README.md`](c:/Repos/mpmahj/apps/client/src/assets/tiles/README.md).
- Canonical order is locked as:
  - Joker
  - Flowers `F1` through `F8`
  - Bam `1-9`, then Green Dragon
  - Crak `1-9`, then Red Dragon
  - Dot `1-9`, then White Dragon
  - Winds
  - Blank
- Auto-sort the player rack on any concealed-hand change, including:
  - draw into hand
  - receive/pass resolution
  - discard out of hand
  - call/claim resolution
  - joker exchange resolution
  - Charleston hand changes
  - reconnect/snapshot restore
  - history playback snapshot render
- Remove the rack-local `Sort` button from the player rack and from any parent component paths
  that still pass `onSort`.
- Add subtle visual grouping inside the concealed player rack by inserting one extra base gap only
  at suit/group boundaries.
- The rack spacing rule is visual only. It does not change keyboard order, focus logic, tile
  identity, hit targets, or selection semantics.
- Group dragons with their corresponding suit-color family:
  - Green Dragon with Bams
  - Red Dragon with Craks
  - White Dragon with Dots
- Preserve tile-instance identity through any resort so glow/highlight/selection state stays
  attached to the correct tile instance as tiles move.

**Out of scope:**

- Changing flower pattern-matching semantics. Flowers remain interchangeable for pattern matching.
- Changing Hint Panel flower rendering. Hint-facing flower visuals may continue to normalize to
  `F1`.
- Reordering exposed melds.
- Reordering Charleston staging slots.
- Rewriting keyboard navigation behavior beyond preserving existing order/interaction semantics.
- Discard-pile sorting behavior and settings controls.
- Mobile-phone layout support beyond existing behavior.

## Acceptance Criteria

- AC-1: A shared tile comparator exists and is used for client-facing rack auto-sort behavior
  instead of inline numeric sorts.
- AC-2: The canonical comparator uses this exact order:
  Joker -> Flowers `F1..F8` -> Bam `1..9` -> Green Dragon -> Crak `1..9` -> Red Dragon -> Dot
  `1..9` -> White Dragon -> Winds -> Blank.
- AC-3: The player's concealed rack auto-sorts after any concealed-hand change without requiring a
  manual `Sort` action.
- AC-4: The rack-local `Sort` button no longer appears anywhere in gameplay UI.
- AC-5: The concealed rack inserts one extra base gap only at group boundaries, producing a subtle
  visual separation between:
  - Jokers and Flowers
  - Flowers and Bam/Green group
  - Bam/Green and Crak/Red group
  - Crak/Red and Dot/White group
  - Dot/White and Winds
  - Winds and Blanks
- AC-6: Within the rack, dragons render adjacent to their corresponding suit-color group rather
  than as a separate honor block.
- AC-7: Existing glow ring, newly received treatment, selected state, and other tile-instance UI
  treatments remain on the same tile instance after resort.
- AC-8: Duplicate tiles do not cause highlight state to jump to the wrong instance after resort.
- AC-9: History playback and reconnect/remount render the rack using the canonical comparator and
  preserve legal tile count/identity behavior.

## Edge Cases

- EC-1: Empty groups do not create phantom spacing; extra gap appears only where two adjacent
  rendered tiles cross a real group boundary.
- EC-2: A hand containing only one group (for example all Bams or all Jokers) shows no internal
  extra spacing.
- EC-3: Duplicate tiles where only one instance is highlighted keep the highlight on the correct
  instance after resort.
- EC-4: A newly received glow remains attached to the same tile instance if lower-sorting tiles
  insert ahead of it.
- EC-5: Blank tiles sort last.
- EC-6: Flowers preserve their individual `F1..F8` display order even though pattern matching
  treats flowers as equivalent.

## Primary Files (Expected)

- `apps/client/src/lib/utils/tileUtils.ts`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/lib/game-events/privateEventHandlers.ts`
- `apps/client/src/components/game/PlayerRack.test.tsx`
- `apps/client/src/lib/game-events/privateEventHandlers.test.ts`

## Notes for Implementer

Do not leave comparator logic split across `tileUtils.ts`, `PlayerRack.tsx`, and any event-layer
helpers. This story should establish one reusable comparator/source of truth for client-facing rack
order.

The rack-spacing requirement is intentionally subtle. "Insert one extra base gap" means the normal
base gap remains unchanged between ordinary adjacent tiles, and one additional base-gap unit is
added only when the next rendered tile starts a new group. Do not add leading or trailing phantom
padding for a group.

The rack-spacing requirement applies to the concealed hand row only. Do not apply the grouped-gap
rule to exposed meld rows, staging strips, or opponent racks unless a later story explicitly asks
for that behavior.

Removing the `Sort` button is part of the story, not optional cleanup. The product direction here
is that the rack should always self-organize.

Flower equivalence for pattern matching is not changed here. Rack sorting should preserve
individual flower variant order for display, but hint/pattern rendering may continue to normalize
flower visuals to `F1`.

## Test Plan

- Update `tileUtils` tests or add new utility tests for the canonical comparator:
  - exact order across all tile groups
  - dragon placement inside suit-color families
  - flower `F1..F8` ordering
  - blank-last behavior
- Update `PlayerRack.test.tsx`:
  - assert concealed rack renders canonical order
  - assert extra boundary gap appears only between real group boundaries
  - assert no `rack-sort-button` renders
  - assert duplicate-safe highlight identity survives resort
- Update event-layer tests in `privateEventHandlers.test.ts`:
  - receiving tiles into hand uses canonical sort behavior
  - newly received/highlighted tile identity survives when lower tiles insert ahead
- Add or update gameplay integration tests under `apps/client/src/features/game/`:
  - draw into hand triggers canonical resort
  - discard out of hand triggers canonical resort
  - reconnect/remount preserves sorted rack and correct highlight identity

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/PlayerRack.test.tsx apps/client/src/lib/game-events/privateEventHandlers.test.ts
npx vitest run apps/client/src/features/game/
npx tsc --noEmit
npx prettier --write docs/implementation/frontend/user-stories/US-082-canonical-rack-auto-sort-and-group-spacing.md docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```
