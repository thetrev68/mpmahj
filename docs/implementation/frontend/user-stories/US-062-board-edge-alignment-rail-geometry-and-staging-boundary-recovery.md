# US-062: Board Edge Alignment, Rail Geometry, and Staging Boundary Recovery

## Status

- State: Proposed
- Priority: Critical
- Batch: G
- Implementation Ready: Yes

## Problem

The board geometry is visibly wrong in several places:

- the right rail stops short of the viewport edge
- the staging strip clips the right border of the sixth slot / tile
- board chrome, action area, rack, and rail columns do not feel aligned to a common grid

These are not isolated cosmetic nits. They make the layout look unfinished and undermine every
other gameplay improvement layered on top.

## Scope

**In scope:**

- Re-establish a desktop board layout where the right rail truly anchors to the viewport edge.
- Fix staging-strip clipping so the sixth slot, tile border, glow, and badges render fully.
- Define consistent horizontal alignment for board content, action area, main surface, and rail.
- Add regression coverage for the rail edge geometry and staging boundary.

**Out of scope:**

- New right-rail content rules.
- Repositioning the discard pile or changing core board information architecture.
- Mobile-first redesign; mobile only needs to avoid regression.

## Acceptance Criteria

- AC-1: On desktop layouts where the right rail is visible, the rail visually reaches the viewport
  right edge with no unintended outer gutter beyond the rail container.
- AC-2: The rail uses a deliberate edge treatment:
  - flush edge, or
  - explicitly spec'd inset edge
    but not the current accidental partial gutter.
- AC-3: The main board column and right rail align to a shared outer layout system; the rail does
  not appear arbitrarily detached from the board.
- AC-4: The staging strip renders all six slots without clipping the rightmost border, badge,
  shadow, or glow.
- AC-5: The sixth staging position remains fully visible when populated by:
  - a normal tile
  - a blind tile badge
  - a selected tile
  - a glowing/new tile state
- AC-6: No parent container on the staging strip path uses overflow settings that visually crop the
  intended sixth-slot edge treatment.
- AC-7: Desktop alignment of top controls, status bar, board body, action area, and rail is
  intentional and consistent rather than independently offset.
- AC-8: A regression test or layout assertion exists for the sixth-slot boundary.
- AC-9: A regression test or layout assertion exists for the right-rail edge occupancy.

## Edge Cases

- EC-1: The fix does not introduce horizontal scrolling at common desktop widths.
- EC-2: The rail remains usable when history or hint content is taller than the main board.
- EC-3: Badge or focus-ring overflow on the last staging tile remains visible rather than clipped.
- EC-4: Tablet widths that hide the rail do not inherit dead spacing reserved for the old layout.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/StagingStrip.test.tsx`

## Notes for Implementer

### Geometry rule

Do not treat this as one-off padding cleanup. Fix the parent layout contract first, then the
staging strip overflow path. The current failures strongly suggest competing container assumptions.

### Visual-proof requirement

At least one test or storybook-style assertion should explicitly guard the rightmost staging slot
and the right rail wrapper classes. Avoid "looks fine on my machine" verification only.

## Test Plan

- Component tests:
  - staging strip six-slot container classes
  - rightmost slot not inside a clipping container
- Board layout tests:
  - desktop rail wrapper classes
  - no leftover desktop right gutter beyond the rail
- Manual visual verification:
  - wide desktop
  - standard laptop width
  - tablet width where rail hides

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/StagingStrip.test.tsx
npx vitest run src/components/game/GameBoard.test.tsx
npx tsc --noEmit
```
