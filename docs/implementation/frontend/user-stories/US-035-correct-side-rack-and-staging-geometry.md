# US-035: Correct Side Rack + Side Staging Geometry

## Status

- State: Not Started
- Priority: High
- Batch: B

## Problem

Left/right seat racks and staging strips do not match the intended top-player layout model and spacing.

## Scope

- Rebuild left/right opponent rack + staging as rotated group variants of the top-seat layout.
- Keep spacing, tile separation, and staging distance consistent across all non-local seats.

## Acceptance Criteria

- AC-1: Left and right racks match top rack geometry when rotated 90 degrees.
- AC-2: Left and right staging appears in front of rack (not merged into rack region).
- AC-3: Tile spacing on side seats is consistent and visually even.

## Edge Cases

- EC-1: Works when seat animation/entry classes are active.
- EC-2: No overlap with center board elements at common desktop resolutions.

## Primary Files (Expected)

- `apps/client/src/components/game/OpponentRack.tsx`
- `apps/client/src/components/game/rackStyles.ts`
- `apps/client/src/components/game/seatAnimations.ts`
- `apps/client/src/components/game/PlayingPhasePresentation.tsx`

## Test Plan

- Extend `OpponentRack.test.tsx` with orientation/spacing assertions.
- Add visual snapshot or DOM-geometry assertions for side staging placement.
