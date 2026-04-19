# US-079: Game Header Simplification and Board Chrome Cohesion

## Status

- State: Completed
- Priority: Medium
- Batch: L
- Implementation Ready: Yes

## Problem

The game’s top-edge chrome is too dense and inconsistent across phases. `CharlestonTracker` is too
dense and partially redundant, `GameplayStatusBar` should follow the same hierarchy principles
when gameplay is user-tested, and `WallCounter` feels visually detached from both. Together they
create a busy board edge that does not support the primary task as cleanly as it should.

## Scope

**In scope:**

- Simplify top-bar hierarchy across Charleston and gameplay.
- Apply the same chrome principles to both `CharlestonTracker` and `GameplayStatusBar`.
- Keep pass direction and phase progress primary.
- Keep the timer visible, but subordinate to pass direction/progress.
- Remove the aggregate `3/4 ready` count from the Charleston startup strip and keep only the
  per-seat readiness row as the readiness detail model.
- Keep the per-seat readiness row, but render it as lower-emphasis supporting information.
- Make `WallCounter` feel like part of the same chrome family instead of a separate black widget.

**Out of scope:**

- New pass-direction animation system.
- Right-rail hint content redesign.
- Player-zone layout changes.

## Acceptance Criteria

- AC-1: `CharlestonTracker` communicates pass direction and phase progress more clearly than
  readiness bookkeeping.
- AC-2: The aggregate ready count is removed from the tracker for Charleston startup presentation.
- AC-3: Per-seat readiness remains available, but with lower visual emphasis than pass direction
  and phase progress.
- AC-4: The timer remains visible and legible without dominating the strip.
- AC-5: `WallCounter` uses a treatment that feels visually related to the tracker chrome rather
  than like an unrelated black floating widget.
- AC-6: `GameplayStatusBar` follows the same overall chrome hierarchy principles when rendered in
  gameplay, even if exact content differs from Charleston.

## Edge Cases

- EC-1: The simplified header model must still work in all Charleston stages, including voting and
  blind-pass states.
- EC-2: Low-time timer states must remain noticeable even after hierarchy simplification.
- EC-3: Gameplay top-bar states must remain readable even though they use `GameplayStatusBar`
  rather than `CharlestonTracker`.

## Primary Files (Expected)

- `apps/client/src/components/game/CharlestonTracker.tsx`
- `apps/client/src/components/game/CharlestonTimer.tsx`
- `apps/client/src/components/game/GameplayStatusBar.tsx`
- `apps/client/src/components/game/WallCounter.tsx`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/CharlestonTracker.test.tsx`
- `apps/client/src/components/game/GameplayStatusBar.test.tsx`
- `apps/client/src/components/game/WallCounter.test.tsx`

## Notes for Implementer

Do not redesign the top chrome into a totally different interaction model. This story is about
hierarchy and cohesion, not a ground-up replacement.

Make the startup Charleston version concrete:

- primary: pass direction + progress
- secondary: timer
- tertiary: per-seat readiness
- removed from startup strip: aggregate ready count

Gameplay is included in scope, but the exact gameplay content can differ. The requirement is that
the same chrome hierarchy principles carry over when `GameplayStatusBar` is visible.

## Test Plan

- Update tracker tests to reflect the new hierarchy and any reduced redundancy.
- Update gameplay-status-bar tests to reflect the shared chrome-hierarchy approach.
- Verify timer visibility and wall-counter rendering remain correct.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/CharlestonTracker.test.tsx apps/client/src/components/game/WallCounter.test.tsx
npx vitest run apps/client/src/components/game/GameplayStatusBar.test.tsx
npx tsc --noEmit
```
