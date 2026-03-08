# US-038: Staging Interaction Consistency (Hover, Ordering, No Glow)

## Status

- State: Not Started
- Priority: High
- Batch: C

## Problem

Staging interactions are inconsistent: hover elevation persists after move, outgoing order starts in middle, incoming tiles cannot always be interacted with, and staging glow is excessive.

## Scope

- Ensure hover-lift is hover-only and resets when pointer leaves.
- Outgoing staging fill order is always left-to-right.
- Incoming staging tiles always support hover and click-to-absorb behavior.
- Remove glow state from tiles once in staging.

## Acceptance Criteria

- AC-1: Hover elevation is not sticky after click/move.
- AC-2: Outgoing staged tiles populate from slot 0 left-to-right.
- AC-3: Incoming staged tiles react to hover and click in all valid contexts.
- AC-4: Staging tiles do not use selected glow styling.

## Edge Cases

- EC-1: Blind incoming tile flip still works before absorb.
- EC-2: Keyboard focus state remains visible if pointer hover styling removed.

## Primary Files (Expected)

- `apps/client/src/components/game/Tile.tsx`
- `apps/client/src/components/game/Tile.css`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/hooks/useTileSelection.ts`

## Test Plan

- Extend `StagingStrip.test.tsx` for left-to-right slot fill and incoming click behavior.
- Extend `Tile.test.tsx` for hover-up/hover-out state reset.
