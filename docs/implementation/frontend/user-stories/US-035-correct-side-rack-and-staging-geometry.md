# US-035: Correct Side Rack + Side Staging Geometry

## Status

- State: Not Started
- Priority: High
- Batch: B

## Problem

Left/right seat racks and staging strips do not match the intended top-player layout model and spacing.

## Scope

- Fix left/right opponent rack containers so they use the same tile count, gap, and shell size as the top-seat layout, rotated 90 degrees.
- Ensure left/right staging (the `stagingRow` inside `OpponentRack`) renders outside the rack shell (in front of the rack toward the table center), not merged into the tile area.
- Keep tile spacing (`gap-0.5`, `OPPONENT_TILE_WIDTH_PX`, `TILE_GAP_PX`) consistent across all non-local seats. [Trevor: because the tiles are rotated, the spacing is between top/bottom, not between left/right].

## Acceptance Criteria

- AC-1: Left and right racks match top rack geometry when rotated 90 degrees (same tile size and gap).
- AC-2: Left and right staging appears in front of the rack (toward table center), not inside the rack shell region.
- AC-3: Tile spacing on side seats is visually even and matches top-seat spacing.

## Edge Cases

- EC-1: Works correctly when seat animation/entry classes (from `seatAnimations.ts`) are active.
- EC-2: No overlap with center board elements at 1280px and 1440px wide desktop viewports.

## Primary Files (Expected)

- `apps/client/src/components/game/OpponentRack.tsx` — fix `rackShellClass` and staging row placement for left/right positions
- `apps/client/src/components/game/rackStyles.ts` — adjust shared rack shell dimensions if needed
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — correct path (not `PlayingPhasePresentation.tsx` in `components/game/`)

## Notes for Implementer

- **`OpponentRack.tsx` current structure**: The component uses `position` (`'top' | 'left' | 'right'`) derived from `getOpponentPosition(yourSeat, player.seat)`. For vertical positions (`left`/`right`), `isVertical = true` and the rack shell gets a fixed `height` instead of `width`.
- **Staging placement**: For top position, `stagingRow` renders after the rack shell (`!isVertical ? stagingRow : null`). For vertical positions, `stagingRow` renders inside the shell (`{isVertical ? stagingRow : null}`). If staging is merged into the rack shell for vertical seats, move it outside the shell div, below/above it depending on which side it should face the table.
- **`rackShellClass` for left/right**: Currently uses `flex flex-row items-stretch gap-1` (right) and `flex flex-row-reverse items-stretch gap-1` (left). Verify tile size, gap, and container dimensions match the top-seat values.
- **`OPPONENT_RACK_SPAN_PX`**: Currently computed as `OPPONENT_TILE_WIDTH_PX * 19 + TILE_GAP_PX * 18 = 614px`. This value is the same for all positions — confirm left/right use the same span as their height dimension.
- **`seatAnimations.ts`**: Provides `SEAT_ENTRY_CLASS` used in `StagingStrip.tsx`. No changes expected here unless a new entry direction is needed for side staging.
- **No DOM-geometry tests**: Use class/attribute assertions in unit tests (e.g. check that `stagingRow` is rendered outside the shell div for left/right seats). Do not use `getBoundingClientRect()` as it returns `0` in jsdom.

## Test Plan

- Update `OpponentRack.test.tsx`:
  - For `left` and `right` positions: assert that `opponent-staging-*` testid is rendered as a sibling of the rack shell (outside it), not inside.
  - Assert rack shell has expected width/height values for vertical positions.
- Run `npx tsc --noEmit` and `npx vitest run` after changes.
