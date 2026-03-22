# US-078: Charleston Action Bar Hierarchy and Rare Mahjong Demotion

## Status

- State: Proposed
- Priority: High
- Batch: K
- Implementation Ready: Yes

## Problem

The current Charleston `ActionBar` does not establish a strong, well-anchored action hierarchy.
The instruction reads like a floating notification, the `Proceed` action lacks enough confidence,
and the `Mahjong` control is too visually prominent for a rare edge-case action.

## Scope

**In scope:**

- Improve the visual anchoring of Charleston instruction text inside the action system.
- Strengthen `Proceed` as the primary Charleston CTA.
- Keep `Mahjong` visible and locked in place with `Proceed`, but demote its default emphasis.
- Ensure the Charleston `Mahjong` treatment is subtle-visible by default.
- Ensure the Charleston `Mahjong` treatment respects dark/light theme styling.
- Preserve stable control placement; the button must not move around phase-to-phase or turn-to-turn.

**Out of scope:**

- Deciding backend Charleston Mahjong rules.
- Hint-panel redesign.
- Board-wide chrome refactoring outside action-bar-local needs.

## Acceptance Criteria

- AC-1: Charleston instruction text feels visually attached to the action controls rather than like
  a detached toast.
- AC-2: `Proceed` is the clear primary action in Charleston.
- AC-3: `Mahjong` remains visible in Charleston and stays locked in place with the `Proceed`
  button.
- AC-4: `Mahjong` no longer reads as a primary CTA when the state is the normal startup
  Charleston case.
- AC-5: The `Mahjong` treatment works in both dark and light themes.
- AC-6: If `canDeclareMahjong` becomes true, the button can become more apparent without changing
  its layout position.

## Edge Cases

- EC-1: Rare valid Charleston Mahjong states must still remain discoverable.
- EC-2: Read-only/historical states must not accidentally inherit live Charleston CTA emphasis.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/ui/button.tsx`
- `apps/client/src/components/game/ActionBar.test.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.test.tsx`

## Notes for Implementer

Do not solve this by hiding the `Mahjong` button. The button must remain present, just quieter.

Avoid a bright orange “warning” treatment. Prefer a calmer secondary/action-item treatment that can
still harmonize with shadcn/ui button primitives and theme tokens.

## Test Plan

- Update or add tests for Charleston CTA ordering and visibility.
- Add theme-aware assertions where practical for the demoted Mahjong treatment.
- Verify layout position remains stable regardless of `canDeclareMahjong`.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/ActionBar.test.tsx apps/client/src/components/game/ActionBarPhaseActions.test.tsx
npx tsc --noEmit
```
