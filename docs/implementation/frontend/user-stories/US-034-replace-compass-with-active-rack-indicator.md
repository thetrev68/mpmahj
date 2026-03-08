# US-034: Replace Compass With Active Rack Indicator

## Status

- State: Not Started
- Priority: Medium
- Batch: B

## Problem

Compass orientation is misleading relative to actual seat placement.

## Scope

- Remove `WindCompass` from game UI.
- Add turn-state highlight ring around the active player's rack zone.
- Keep orientation understandable without a compass.

## Acceptance Criteria

- AC-1: Compass component is not rendered in gameplay.
- AC-2: Exactly one rack zone is visually marked as active turn owner.
- AC-3: Active ring updates as turn advances.

## Edge Cases

- EC-1: Dead-hand players do not receive active ring unless it is their turn.
- EC-2: No active ring during non-turn phases where applicable.

## Primary Files (Expected)

- `apps/client/src/components/game/WindCompass.tsx` (remove usage)
- `apps/client/src/components/game/TurnIndicator.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/OpponentRack.tsx`

## Test Plan

- Update/remove `WindCompass.test.tsx` expectations tied to rendering.
- Add rack highlight tests in `PlayerRack.test.tsx` / `OpponentRack.test.tsx`.
