# US-085: Board Width Math and Fixed Positioning Recovery

## Status

- State: Completed
- Priority: High
- Batch: M
- Implementation Ready: Yes

## Problem

The UI audit identified a set of concrete layout bugs that do not require a full board-geometry
refactor, but do require immediate cleanup because they create visible overlap, misplaced board
chrome, and avoidable horizontal scrolling.

The specific failures are:

- the top-right board control strip can crowd or overlap adjacent layout regions
- the square-board width math does not fully account for desktop padding assumptions
- the desktop layout removes right-side breathing room entirely
- `TurnIndicator` is positioned relative to the viewport instead of the board container
- `PlayerRack` still relies on a fixed `1038px` width that can produce horizontal scroll on
  mid-width viewports

These are implementation-ready recovery fixes. They should be corrected before any larger
Charleston board-region refactor so the current layout stops fighting the viewport.

## Scope

**In scope:**

- Correct the desktop square-board width math in `GameBoard`.
- Restore deliberate large-screen spacing so the rail and board controls do not feel jammed
  against the viewport edge.
- Reposition or constrain the top-right control strip so `Leave Game` and `Log Out` no longer
  crowd neighboring layout regions.
- Move `TurnIndicator` positioning off viewport-percentage `fixed` placement and onto a
  board-relative placement model.
- Remove or relax the fixed-width player-rack assumption that causes horizontal scroll on
  mid-width desktop viewports.
- Ensure the player rack remains visually contained within the intended board area at the target
  desktop widths for this story.

**Out of scope:**

- Full player-zone / staging / action-pane region redesign.
- Side-rack perimeter alignment changes.
- Header stacking and top-chrome shared-flow redesign.
- Selection-counter relocation.
- Deeper rack-shell geometry changes already covered by earlier stories.

## Acceptance Criteria

- AC-1: On large-screen layouts with the right rail visible, the board width calculation accounts
  for the actual reserved horizontal space and does not rely on stale undercounted math.
- AC-2: Desktop layout preserves intentional right-side breathing room rather than running the rail
  flush to the viewport edge by accident.
- AC-3: The top-right control strip no longer visually crowds or overlaps adjacent layout regions
  in the audited large-screen Charleston view.
- AC-4: `TurnIndicator` positions relative to the board container rather than the full viewport, so
  the east-side indicator does not drift into the right rail on desktop layouts.
- AC-5: Mid-width desktop viewports no longer produce horizontal scrolling due to the fixed-width
  player rack.
- AC-6: The player rack remains visually contained inside the intended board area at the verified
  viewports for this story.

## Edge Cases

- EC-1: Desktop layouts with the right rail hidden must not inherit dead spacing from the visible
  rail configuration.
- EC-2: `TurnIndicator` and dead-hand badges must remain readable after moving to board-relative
  positioning.
- EC-3: The top-right control strip must remain usable during both live and historical states.
- EC-4: Rack containment fixes must not clip tile focus, selection, or highlight treatments.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/TurnIndicator.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/TurnIndicator.test.tsx`
- `apps/client/src/components/game/PlayerRack.test.tsx`

## Notes for Implementer

Keep this story bounded. This is not the place to redesign the full Charleston board interaction
region. The target is to remove obvious viewport-math and positioning bugs while preserving the
existing board structure as much as possible.

For `TurnIndicator`, the important correction is the positioning model, not the exact styling.
The current `fixed` + viewport-percentage offsets are wrong because the board is no longer the full
viewport-width surface once the rail is visible. The replacement should anchor indicators to the
square board container or another deliberate board-local wrapper.

For `PlayerRack`, do not keep the current hardcoded `1038px` width as the sole layout strategy.
The rack can still preserve its intended tile sizing, but it must degrade safely at the audited
mid-width desktop range without creating page-level horizontal scroll.

For the top-right controls, prefer deliberate placement over ad hoc nudging. The fix can move the
strip or adjust its container relationship, but it should clearly stop treating the right edge of
the square-board container as a safe universal anchor when a rail sits beside it.

## Test Plan

- Update board layout tests so they assert:
  - corrected large-screen width math assumptions
  - restored intended desktop padding / breathing room
  - non-overlapping board-control-strip container structure
- Update turn-indicator tests so they assert:
  - board-relative positioning model instead of viewport-fixed percentage placement
  - dead-hand badge placement follows the same model
- Update player-rack tests so they assert:
  - the rack is no longer hardcoded to the current fixed-width overflow behavior
  - containment classes / structure support safe rendering at constrained widths

## Visual Verification

Required before completion:

1. `charleston-dark-lg`
   - confirm top-right controls no longer crowd neighboring regions
   - confirm east-side turn indicator stays on the board, not in the rail
2. `charleston-dark-midwidth`
   - confirm no horizontal scroll introduced by rack width
   - confirm player rack remains contained
3. `playing-dark-lg`
   - confirm turn indicators still read correctly in non-Charleston play

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/GameBoard.test.tsx apps/client/src/components/game/TurnIndicator.test.tsx apps/client/src/components/game/PlayerRack.test.tsx
npx tsc --noEmit
```
